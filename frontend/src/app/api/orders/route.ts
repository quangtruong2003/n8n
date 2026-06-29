import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

// GET /api/orders — List orders with filters
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

    const status = url.searchParams.get('status')
    const paymentStatus = url.searchParams.get('payment_status')
    const branchId = url.searchParams.get('branch_id')

    const conditions: string[] = ['o.tenant_id = ?']
    const args: (string | number)[] = [user.tenantId]

    if (status) {
      conditions.push('o.status = ?')
      args.push(status)
    }

    if (paymentStatus) {
      conditions.push('o.payment_status = ?')
      args.push(paymentStatus)
    }

    if (branchId) {
      conditions.push('o.branch_id = ?')
      args.push(branchId)
    }

    const where = conditions.join(' AND ')

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM "Order" o WHERE ${where}`,
      args,
    })
    const total = (countResult.rows[0].total as number) || 0

    const result = await db.execute({
      sql: `SELECT o.*, c.full_name as customer_name, u.full_name as user_name
            FROM "Order" o
            LEFT JOIN Customer c ON c.id = o.customer_id
            LEFT JOIN User u ON u.id = o.user_id
            WHERE ${where}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (err: any) {
    console.error('List orders error:', err?.message, err?.stack)
    return NextResponse.json(
      { success: false, error: 'Lỗi server: ' + (err?.message || 'unknown') },
      { status: 500 }
    )
  }
})

// POST /api/orders — Create order
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
      const { branch_id, customer_id, items, note } = body as {
        branch_id: string
        customer_id?: string
        items: { product_id: string; quantity: number; note?: string }[]
        note?: string
      }

      // Validate branch
      if (!branch_id) {
        return NextResponse.json(
          { success: false, error: 'Chi nhánh là bắt buộc' },
          { status: 400 }
        )
      }

      const branch = await db.execute({
        sql: 'SELECT id FROM Branch WHERE id = ? AND tenant_id = ? AND active = 1',
        args: [branch_id, user.tenantId],
      })
      if (branch.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Chi nhánh không tồn tại' },
          { status: 400 }
        )
      }

      // Validate customer if provided
      if (customer_id) {
        const cust = await db.execute({
          sql: 'SELECT id FROM Customer WHERE id = ? AND tenant_id = ? AND active = 1',
          args: [customer_id, user.tenantId],
        })
        if (cust.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Khách hàng không tồn tại' },
            { status: 400 }
          )
        }
      }

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Đơn hàng phải có ít nhất 1 sản phẩm' },
          { status: 400 }
        )
      }

      // Fetch and validate all products, check stock for type='product'
      const productMap = new Map<string, { id: string; name: string; price: number; type: string; stock_quantity: number }>()
      for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity < 1) {
          return NextResponse.json(
            { success: false, error: 'Item không hợp lệ (cần product_id và quantity >= 1)' },
            { status: 400 }
          )
        }

        if (productMap.has(item.product_id)) continue

        const product = await db.execute({
          sql: 'SELECT id, name, price, type, stock_quantity FROM Product WHERE id = ? AND tenant_id = ? AND active = 1',
          args: [item.product_id, user.tenantId],
        })
        if (product.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: `Sản phẩm ${item.product_id} không tồn tại` },
            { status: 400 }
          )
        }
        const p = product.rows[0]
        productMap.set(item.product_id, {
          id: p.id as string,
          name: p.name as string,
          price: p.price as number,
          type: p.type as string,
          stock_quantity: (p.stock_quantity as number) ?? 0,
        })
      }

      // Inventory check for type='product'
      const stockDeductions = new Map<string, number>()
      for (const item of items) {
        const product = productMap.get(item.product_id)!
        if (product.type === 'product') {
          const current = stockDeductions.get(item.product_id) ?? 0
          const requested = current + item.quantity
          if (requested > product.stock_quantity) {
            return NextResponse.json(
              { success: false, error: `Sản phẩm "${product.name}" chỉ còn ${product.stock_quantity} trong kho` },
              { status: 400 }
            )
          }
          stockDeductions.set(item.product_id, requested)
        }
      }

      // Generate order_code: ORD-{5 digit random}
      const codeNum = String(Math.floor(10000 + Math.random() * 90000))
      const orderCode = `ORD-${codeNum}`

      // Calculate totals
      let subtotal = 0
      const orderItems = items.map((item) => {
        const product = productMap.get(item.product_id)!
        const itemTotal = product.price * item.quantity
        subtotal += itemTotal
        return {
          id: randomUUID(),
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: product.price,
          total: itemTotal,
          note: item.note || null,
        }
      })

      const total = subtotal

      const orderId = randomUUID()

      // Insert Order
      await db.execute({
        sql: `INSERT INTO "Order" (id, tenant_id, branch_id, customer_id, user_id, order_code, status, subtotal, discount_amount, tax_amount, total, payment_status, note, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 0, ?, 'unpaid', ?, datetime('now'), datetime('now'))`,
        args: [
          orderId,
          user.tenantId,
          branch_id,
          customer_id || null,
          user.id,
          orderCode,
          subtotal,
          total,
          note || null,
        ],
      })

      // Insert OrderItems
      for (const oi of orderItems) {
        await db.execute({
          sql: `INSERT INTO OrderItem (id, order_id, product_id, quantity, unit_price, discount_amount, total, note, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
          args: [oi.id, orderId, oi.product_id, oi.quantity, oi.unit_price, oi.total, oi.note],
        })
      }

      // Reserve stock: deduct stock_quantity for products
      for (const [productId, qty] of stockDeductions) {
        await db.execute({
          sql: `UPDATE Product SET stock_quantity = stock_quantity - ?, updated_at = datetime('now') WHERE id = ?`,
          args: [qty, productId],
        })
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'order', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          orderId,
          JSON.stringify({ order_code: orderCode, total, items_count: orderItems.length }),
        ],
      })

      const created = await db.execute({
        sql: 'SELECT * FROM "Order" WHERE id = ?',
        args: [orderId],
      })

      return NextResponse.json({
        success: true,
        data: { ...created.rows[0], items: orderItems },
      }, { status: 201 })
    } catch (err) {
      console.error('Create order error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
