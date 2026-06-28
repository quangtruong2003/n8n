import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

// GET /api/roles — List roles for tenant with permission counts
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const url = req.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as total FROM Role WHERE tenant_id = ?',
      args: [user.tenantId],
    })
    const total = (countResult.rows[0].total as number) || 0

    const result = await db.execute({
      sql: `SELECT r.id, r.name, r.description, r.created_at,
                   (SELECT COUNT(*) FROM Permission p WHERE p.role_id = r.id) as permission_count
            FROM Role r
            WHERE r.tenant_id = ?
            ORDER BY r.created_at ASC
            LIMIT ? OFFSET ?`,
      args: [user.tenantId, limit, offset],
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (err) {
    console.error('List roles error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// POST /api/roles — Create role
export const POST = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const { name, description } = body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Tên vai trò là bắt buộc' },
          { status: 400 }
        )
      }

      // Check unique constraint (tenant_id, name)
      const existing = await db.execute({
        sql: 'SELECT id FROM Role WHERE tenant_id = ? AND name = ?',
        args: [user.tenantId, name.trim()],
      })
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Tên vai trò đã tồn tại' },
          { status: 409 }
        )
      }

      const roleId = randomUUID()

      await db.execute({
        sql: `INSERT INTO Role (id, tenant_id, name, description, created_at)
              VALUES (?, ?, ?, ?, datetime('now'))`,
        args: [roleId, user.tenantId, name.trim(), description || null],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'role', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          roleId,
          JSON.stringify({ name: name.trim(), description: description || null }),
        ],
      })

      const created = await db.execute({
        sql: 'SELECT * FROM Role WHERE id = ?',
        args: [roleId],
      })

      return NextResponse.json({
        success: true,
        data: created.rows[0],
      }, { status: 201 })
    } catch (err) {
      console.error('Create role error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
