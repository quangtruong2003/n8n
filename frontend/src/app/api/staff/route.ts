import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'
import { hashPassword } from '../../../lib/auth/password'

// GET /api/staff — List staff for tenant
export const GET = withAuth(
  async (req, { user }) => {
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
        sql: "SELECT COUNT(*) as total FROM User WHERE tenant_id = ? AND role = 'staff' AND active = 1",
        args: [user.tenantId],
      })
      const total = (countResult.rows[0].total as number) || 0

      const result = await db.execute({
        sql: `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role, u.active, u.created_at, u.updated_at
              FROM User u
              WHERE u.tenant_id = ? AND u.role = 'staff' AND u.active = 1
              ORDER BY u.created_at DESC
              LIMIT ? OFFSET ?`,
        args: [user.tenantId, limit, offset],
      })

      return NextResponse.json({
        success: true,
        data: result.rows,
        meta: { total, page, limit },
      })
    } catch (err) {
      console.error('List staff error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)

// POST /api/staff — Create staff (owner only)
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
      const { username, password, full_name, phone, email, branch_ids } = body

      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Tên đăng nhập là bắt buộc' },
          { status: 400 }
        )
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
          { status: 400 }
        )
      }

      // Check duplicate username
      const existingUser = await db.execute({
        sql: 'SELECT id FROM User WHERE username = ?',
        args: [username.trim()],
      })

      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Tên đăng nhập đã tồn tại' },
          { status: 409 }
        )
      }

      const userId = randomUUID()
      const passwordHash = await hashPassword(password)

      await db.execute({
        sql: `INSERT INTO User (id, username, password_hash, role, tenant_id, full_name, phone, email, active, created_at, updated_at)
              VALUES (?, ?, ?, 'staff', ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        args: [userId, username.trim(), passwordHash, user.tenantId, full_name || null, phone || null, email || null],
      })

      // Assign branches if provided
      if (Array.isArray(branch_ids) && branch_ids.length > 0) {
        for (const branchId of branch_ids) {
          await db.execute({
            sql: 'INSERT INTO UserBranch (user_id, branch_id) VALUES (?, ?)',
            args: [userId, branchId],
          })
        }
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'user', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          userId,
          JSON.stringify({ username: username.trim(), full_name, phone, email, role: 'staff', branch_ids }),
        ],
      })

      const created = await db.execute({
        sql: 'SELECT id, username, full_name, phone, email, role, active, created_at FROM User WHERE id = ?',
        args: [userId],
      })

      return NextResponse.json({
        success: true,
        data: created.rows[0],
      }, { status: 201 })
    } catch (err) {
      console.error('Create staff error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
