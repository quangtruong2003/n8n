import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// PUT /api/staff/{id} — Update staff info
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const staffId = req.nextUrl.pathname.split('/').at(-1)!

      // Verify staff exists and belongs to tenant
      const existing = await db.execute({
        sql: "SELECT * FROM User WHERE id = ? AND tenant_id = ? AND role = 'staff'",
        args: [staffId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy nhân viên' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const allowedFields = ['full_name', 'phone', 'email']
      const updates: string[] = []
      const args: (string | number)[] = []

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`)
          args.push(body[field])
        }
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không có trường nào để cập nhật' },
          { status: 400 }
        )
      }

      updates.push("updated_at = datetime('now')")
      args.push(staffId)

      await db.execute({
        sql: `UPDATE User SET ${updates.join(', ')} WHERE id = ?`,
        args,
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'user', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          staffId,
          JSON.stringify(existing.rows[0]),
          JSON.stringify(body),
        ],
      })

      const updated = await db.execute({
        sql: 'SELECT id, username, full_name, phone, email, role, active, created_at, updated_at FROM User WHERE id = ?',
        args: [staffId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update staff error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)

// DELETE /api/staff/{id} — Soft delete staff, remove sessions
export const DELETE = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const staffId = req.nextUrl.pathname.split('/').at(-1)!

      // Verify staff exists and belongs to tenant
      const existing = await db.execute({
        sql: "SELECT id, username, full_name, active FROM User WHERE id = ? AND tenant_id = ? AND role = 'staff'",
        args: [staffId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy nhân viên' },
          { status: 404 }
        )
      }

      const staff = existing.rows[0]

      if (staff.active === 0) {
        return NextResponse.json(
          { success: false, error: 'Nhân viên đã bị vô hiệu hóa' },
          { status: 400 }
        )
      }

      // Soft delete
      await db.execute({
        sql: "UPDATE User SET active = 0, updated_at = datetime('now') WHERE id = ?",
        args: [staffId],
      })

      // Delete sessions
      await db.execute({
        sql: 'DELETE FROM Session WHERE user_id = ?',
        args: [staffId],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, created_at)
              VALUES (?, ?, ?, 'delete', 'user', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          staffId,
          JSON.stringify(staff),
        ],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã vô hiệu hóa nhân viên',
      })
    } catch (err) {
      console.error('Delete staff error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
