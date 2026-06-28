import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  refunded: [],
}

// PATCH /api/orders/{id}/status — Change order status
export const PATCH = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      // Extract orderId from path: /api/orders/[id]/status
      const pathParts = req.nextUrl.pathname.split('/')
      const orderId = pathParts[pathParts.length - 2]!

      const body = await req.json()
      const { status: newStatus } = body as { status: string }

      if (!newStatus) {
        return NextResponse.json(
          { success: false, error: 'Trạng thái mới là bắt buộc' },
          { status: 400 }
        )
      }

      // Fetch current order
      const orderResult = await db.execute({
        sql: 'SELECT * FROM "Order" WHERE id = ? AND tenant_id = ?',
        args: [orderId, user.tenantId],
      })

      if (orderResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy đơn hàng' },
          { status: 404 }
        )
      }

      const order = orderResult.rows[0]
      const currentStatus = order.status as string

      // Validate transition
      const allowed = VALID_TRANSITIONS[currentStatus] || []
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { success: false, error: `Không thể chuyển từ "${currentStatus}" sang "${newStatus}"` },
          { status: 400 }
        )
      }

      // If cancelled → restore stock for products
      if (newStatus === 'cancelled') {
        const items = await db.execute({
          sql: `SELECT oi.product_id, oi.quantity, p.type
                FROM OrderItem oi
                JOIN Product p ON p.id = oi.product_id
                WHERE oi.order_id = ?`,
          args: [orderId],
        })

        for (const item of items.rows) {
          if (item.type === 'product') {
            await db.execute({
              sql: `UPDATE Product SET stock_quantity = stock_quantity + ?, updated_at = datetime('now') WHERE id = ?`,
              args: [item.quantity as number, item.product_id as string],
            })
          }
        }
      }

      // Update status
      await db.execute({
        sql: `UPDATE "Order" SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [newStatus, orderId],
      })

      // If completed → update payment_status if fully paid
      if (newStatus === 'completed') {
        const paymentSum = await db.execute({
          sql: 'SELECT COALESCE(SUM(amount), 0) as total_paid FROM Payment WHERE order_id = ?',
          args: [orderId],
        })
        const totalPaid = paymentSum.rows[0].total_paid as number
        const orderTotal = order.total as number

        if (totalPaid >= orderTotal && orderTotal > 0) {
          await db.execute({
            sql: `UPDATE "Order" SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`,
            args: [orderId],
          })
        }
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'order', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          orderId,
          JSON.stringify({ status: currentStatus }),
          JSON.stringify({ status: newStatus }),
        ],
      })

      const updated = await db.execute({
        sql: 'SELECT * FROM "Order" WHERE id = ?',
        args: [orderId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update order status error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
