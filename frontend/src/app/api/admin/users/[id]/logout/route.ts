import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../../lib/auth/middleware'
import { db } from '../../../../../../lib/db'

export const POST = withAuth(
  async (req, { user }) => {
    try {
      const userId = req.nextUrl.pathname.split('/').at(-2)!

      // 1. Verify target user exists and get tenant_id
      const userResult = await db.execute({
        sql: 'SELECT id, tenant_id FROM User WHERE id = ?',
        args: [userId],
      })

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy người dùng' },
          { status: 404 }
        )
      }

      // 2. Delete all sessions for the target user
      await db.execute({
        sql: 'DELETE FROM Session WHERE user_id = ?',
        args: [userId],
      })

      // 3. Audit log
      const tenantId = userResult.rows[0].tenant_id as string
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, created_at)
              VALUES (?, ?, ?, 'logout', 'user', ?, datetime('now'))`,
        args: [randomUUID(), tenantId, user.id, userId],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã đăng xuất tất cả sessions',
      })
    } catch (err) {
      console.error('Admin force logout error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)
