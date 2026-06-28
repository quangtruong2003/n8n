import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/orders/{id} — Order detail with items + payments
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const orderId = req.nextUrl.pathname.split('/').at(-2)!

    const orderResult = await db.execute({
      sql: `SELECT o.*, c.name as customer_name, c.phone as customer_phone,
                   u.full_name as user_name, b.name as branch_name
            FROM "Order" o
            LEFT JOIN Customer c ON c.id = o.customer_id
            LEFT JOIN User u ON u.id = o.user_id
            LEFT JOIN Branch b ON b.id = o.branch_id
            WHERE o.id = ? AND o.tenant_id = ?`,
      args: [orderId, user.tenantId],
    })

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy đơn hàng' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // Fetch order items with product info
    const itemsResult = await db.execute({
      sql: `SELECT oi.*, p.name as product_name, p.type as product_type, p.sku
            FROM OrderItem oi
            JOIN Product p ON p.id = oi.product_id
            WHERE oi.order_id = ?`,
      args: [orderId],
    })

    // Fetch payments
    const paymentsResult = await db.execute({
      sql: `SELECT py.*, u.full_name as created_by_name
            FROM Payment py
            LEFT JOIN User u ON u.id = py.created_by
            WHERE py.order_id = ?
            ORDER BY py.paid_at DESC`,
      args: [orderId],
    })

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        items: itemsResult.rows,
        payments: paymentsResult.rows,
      },
    })
  } catch (err) {
    console.error('Get order error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
