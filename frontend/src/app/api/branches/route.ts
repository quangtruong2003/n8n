import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

// GET /api/branches — List branches for tenant
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
      sql: 'SELECT COUNT(*) as total FROM Branch WHERE tenant_id = ? AND active = 1',
      args: [user.tenantId],
    })
    const total = (countResult.rows[0].total as number) || 0

    const result = await db.execute({
      sql: `SELECT id, tenant_id, name, address, phone, is_main, active, metadata, created_at, updated_at
            FROM Branch
            WHERE tenant_id = ? AND active = 1
            ORDER BY is_main DESC, created_at ASC
            LIMIT ? OFFSET ?`,
      args: [user.tenantId, limit, offset],
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (err) {
    console.error('List branches error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// POST /api/branches — Create branch (owner only)
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
      const { name, address, phone, is_main } = body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Tên chi nhánh là bắt buộc' },
          { status: 400 }
        )
      }

      // Check if this is the first branch for the tenant
      const existingCount = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM Branch WHERE tenant_id = ? AND active = 1',
        args: [user.tenantId],
      })
      const isFirstBranch = (existingCount.rows[0].total as number) === 0
      const isMainValue = isFirstBranch ? 1 : (is_main ? 1 : 0)

      const branchId = randomUUID()

      await db.execute({
        sql: `INSERT INTO Branch (id, tenant_id, name, address, phone, is_main, active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        args: [branchId, user.tenantId, name.trim(), address || null, phone || null, isMainValue],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'branch', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          branchId,
          JSON.stringify({ name: name.trim(), address, phone, is_main: isMainValue }),
        ],
      })

      const created = await db.execute({
        sql: 'SELECT * FROM Branch WHERE id = ?',
        args: [branchId],
      })

      return NextResponse.json({
        success: true,
        data: created.rows[0],
      }, { status: 201 })
    } catch (err) {
      console.error('Create branch error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
