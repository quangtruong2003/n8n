import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// PUT /api/branches/{id} — Update branch
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const branchId = req.nextUrl.pathname.split('/').at(-1)!

      // 1. Verify branch exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM Branch WHERE id = ? AND tenant_id = ?',
        args: [branchId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy chi nhánh' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const allowedFields = ['name', 'address', 'phone', 'is_main']
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
      args.push(branchId)

      await db.execute({
        sql: `UPDATE Branch SET ${updates.join(', ')} WHERE id = ?`,
        args,
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'branch', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          branchId,
          JSON.stringify(existing.rows[0]),
          JSON.stringify(body),
        ],
      })

      const updated = await db.execute({
        sql: 'SELECT * FROM Branch WHERE id = ?',
        args: [branchId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update branch error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)

// DELETE /api/branches/{id} — Soft delete branch
export const DELETE = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const branchId = req.nextUrl.pathname.split('/').at(-1)!

      // 1. Verify branch exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT id, name, is_main, active FROM Branch WHERE id = ? AND tenant_id = ?',
        args: [branchId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy chi nhánh' },
          { status: 404 }
        )
      }

      const branch = existing.rows[0]

      if (branch.active === 0) {
        return NextResponse.json(
          { success: false, error: 'Chi nhánh đã bị vô hiệu hóa' },
          { status: 400 }
        )
      }

      // 2. Cannot delete main branch
      if (branch.is_main === 1) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa chi nhánh chính' },
          { status: 400 }
        )
      }

      // 3. Cannot delete branch with existing orders
      const orderCount = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM "Order" WHERE branch_id = ?',
        args: [branchId],
      })
      if ((orderCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa chi nhánh còn đơn hàng' },
          { status: 400 }
        )
      }

      // 4. Cannot delete branch with existing bookings
      const bookingCount = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM Booking WHERE branch_id = ?',
        args: [branchId],
      })
      if ((bookingCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa chi nhánh còn lịch hẹn' },
          { status: 400 }
        )
      }

      // 5. Soft delete
      await db.execute({
        sql: "UPDATE Branch SET active = 0, updated_at = datetime('now') WHERE id = ?",
        args: [branchId],
      })

      // 6. Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, created_at)
              VALUES (?, ?, ?, 'delete', 'branch', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          branchId,
          JSON.stringify(branch),
        ],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã vô hiệu hóa chi nhánh',
      })
    } catch (err) {
      console.error('Delete branch error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
