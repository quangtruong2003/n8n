import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

const VALID_METHODS = ['cash', 'transfer', 'card', 'momo', 'zalopay', 'other']

// POST /api/orders/{id}/payments — Add payment to order
export const POST = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      // Extract orderId from path: /api/orders/[id]/payments
      const pathParts = req.nextUrl.pathname.split('/')
      const orderId = pathParts[pathParts.length - 2]!

      // Verify order exists
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

      if (order.status === 'cancelled' || order.status === 'refunded') {
        return NextResponse.json(
          { success: false, error: 'Không thể thanh toán đơn đã hủy' },
          { status: 400 }
        )
      }

      const body = await req.json()
      const { amount, method, reference, note } = body as {
        amount: number
        method: string
        reference?: string
        note?: string
      }

      // Validate amount
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Số tiền không hợp lệ' },
          { status: 400 }
        )
      }

      // Validate method
      if (!method || !VALID_METHODS.includes(method)) {
        return NextResponse.json(
          { success: false, error: `Phương thức không hợp lệ. Chọn: ${VALID_METHODS.join(', ')}` },
          { status: 400 }
        )
      }

      // Insert payment
      const paymentId = randomUUID()
      await db.execute({
        sql: `INSERT INTO Payment (id, order_id, tenant_id, amount, method, reference, note, paid_at, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
        args: [
          paymentId,
          orderId,
          user.tenantId,
          amount,
          method,
          reference || null,
          note || null,
          user.id,
        ],
      })

      // Sum all payments for this order
      const paymentSum = await db.execute({
        sql: 'SELECT COALESCE(SUM(amount), 0) as total_paid FROM Payment WHERE order_id = ?',
        args: [orderId],
      })
      const totalPaid = paymentSum.rows[0].total_paid as number
      const orderTotal = order.total as number

      // Update payment_status
      let newPaymentStatus = 'unpaid'
      if (totalPaid >= orderTotal && orderTotal > 0) {
        newPaymentStatus = 'paid'
      } else if (totalPaid > 0) {
        newPaymentStatus = 'partial'
      }

      await db.execute({
        sql: `UPDATE "Order" SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [newPaymentStatus, orderId],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'payment', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          paymentId,
          JSON.stringify({ order_id: orderId, amount, method, total_paid: totalPaid, payment_status: newPaymentStatus }),
        ],
      })

      const payment = await db.execute({
        sql: 'SELECT * FROM Payment WHERE id = ?',
        args: [paymentId],
      })

      return NextResponse.json({
        success: true,
        data: {
          payment: payment.rows[0],
          total_paid: totalPaid,
          payment_status: newPaymentStatus,
        },
      }, { status: 201 })
    } catch (err) {
      console.error('Add payment error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
