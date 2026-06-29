import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/products/{id} — Product detail
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const productId = req.nextUrl.pathname.split('/').at(-1)!

    const result = await db.execute({
      sql: `SELECT p.*, pc.name as category_name
            FROM Product p
            LEFT JOIN ProductCategory pc ON pc.id = p.category_id
            WHERE p.id = ? AND p.tenant_id = ?`,
      args: [productId, user.tenantId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sản phẩm' },
        { status: 404 }
      )
    }

    const product = result.rows[0]

    // If combo, fetch combo items
    if (product.type === 'combo') {
      const comboResult = await db.execute({
        sql: `SELECT ci.id, ci.product_id, ci.quantity, p.name as product_name, p.type as product_type, p.price as product_price
              FROM ComboItem ci
              JOIN Product p ON p.id = ci.product_id
              WHERE ci.combo_id = ?`,
        args: [productId],
      })
      ;(product as any).combo_items = comboResult.rows
    }

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (err) {
    console.error('Get product error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// PUT /api/products/{id} — Update product
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const productId = req.nextUrl.pathname.split('/').at(-1)!

      // Verify product exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM Product WHERE id = ? AND tenant_id = ?',
        args: [productId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy sản phẩm' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const { name, category_id, price, description, duration_minutes, active } = body
      const combo_items = body.combo_items as { product_id: string; quantity: number }[] | undefined

      // Validate category if provided
      if (category_id !== undefined && category_id !== null) {
        const cat = await db.execute({
          sql: 'SELECT id FROM ProductCategory WHERE id = ? AND tenant_id = ? AND active = 1',
          args: [category_id, user.tenantId],
        })
        if (cat.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Danh mục không tồn tại' },
            { status: 400 }
          )
        }
      }

      // Validate combo items if product is combo and combo_items provided
      const productType = existing.rows[0].type as string
      if (productType === 'combo' && combo_items !== undefined) {
        if (!Array.isArray(combo_items) || combo_items.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Combo phải có ít nhất 1 sản phẩm/dịch vụ' },
            { status: 400 }
          )
        }

        for (const item of combo_items) {
          if (!item.product_id || !item.quantity || item.quantity < 1) {
            return NextResponse.json(
              { success: false, error: 'Combo item không hợp lệ' },
              { status: 400 }
            )
          }

          const product = await db.execute({
            sql: 'SELECT id FROM Product WHERE id = ? AND tenant_id = ? AND active = 1',
            args: [item.product_id, user.tenantId],
          })
          if (product.rows.length === 0) {
            return NextResponse.json(
              { success: false, error: `Sản phẩm ${item.product_id} không tồn tại` },
              { status: 400 }
            )
          }
        }

        const productIds = combo_items.map((ci) => ci.product_id)
        if (new Set(productIds).size !== productIds.length) {
          return NextResponse.json(
            { success: false, error: 'Combo chứa sản phẩm trùng lặp' },
            { status: 400 }
          )
        }
      }

      // Build dynamic update
      const allowedFields = ['name', 'category_id', 'price', 'description', 'duration_minutes', 'active']
      const updates: string[] = []
      const args: (string | number | null)[] = []

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`)
          args.push(body[field])
        }
      }

      if (updates.length === 0 && combo_items === undefined) {
        return NextResponse.json(
          { success: false, error: 'Không có trường nào để cập nhật' },
          { status: 400 }
        )
      }

      // Update product fields if any
      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')")
        args.push(productId)

        await db.execute({
          sql: `UPDATE Product SET ${updates.join(', ')} WHERE id = ?`,
          args,
        })
      }

      // Replace combo items if provided
      if (productType === 'combo' && combo_items !== undefined) {
        await db.execute({
          sql: 'DELETE FROM ComboItem WHERE combo_id = ?',
          args: [productId],
        })

        for (const item of combo_items) {
          await db.execute({
            sql: `INSERT INTO ComboItem (id, combo_id, product_id, quantity) VALUES (?, ?, ?, ?)`,
            args: [randomUUID(), productId, item.product_id, item.quantity],
          })
        }
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'product', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          productId,
          JSON.stringify(existing.rows[0]),
          JSON.stringify(body),
        ],
      })

      const updated = await db.execute({
        sql: 'SELECT * FROM Product WHERE id = ?',
        args: [productId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update product error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)

// DELETE /api/products/{id} — Soft delete product
export const DELETE = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const productId = req.nextUrl.pathname.split('/').at(-1)!

      // Verify product exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM Product WHERE id = ? AND tenant_id = ?',
        args: [productId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy sản phẩm' },
          { status: 404 }
        )
      }

      const product = existing.rows[0]

      if (product.active === 0) {
        return NextResponse.json(
          { success: false, error: 'Sản phẩm đã bị vô hiệu hóa' },
          { status: 400 }
        )
      }

      // Cannot delete if product is in active orders
      const orderItemCount = await db.execute({
        sql: `SELECT COUNT(*) as total FROM OrderItem oi
              JOIN "Order" o ON o.id = oi.order_id
              WHERE oi.product_id = ? AND o.status NOT IN ('cancelled', 'refunded')`,
        args: [productId],
      })
      if ((orderItemCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa sản phẩm đang có đơn hàng' },
          { status: 400 }
        )
      }

      // Cannot delete if product is in active bookings
      const bookingItemCount = await db.execute({
        sql: `SELECT COUNT(*) as total FROM BookingItem bi
              JOIN Booking b ON b.id = bi.booking_id
              WHERE bi.product_id = ? AND b.status NOT IN ('cancelled', 'no_show', 'completed')`,
        args: [productId],
      })
      if ((bookingItemCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa sản phẩm đang có lịch hẹn' },
          { status: 400 }
        )
      }

      // Cannot delete if product is part of an active combo
      if (product.type !== 'combo') {
        const comboCount = await db.execute({
          sql: `SELECT COUNT(*) as total FROM ComboItem ci
                JOIN Product p ON p.id = ci.combo_id
                WHERE ci.product_id = ? AND p.active = 1`,
          args: [productId],
        })
        if ((comboCount.rows[0].total as number) > 0) {
          return NextResponse.json(
            { success: false, error: 'Không thể xóa sản phẩm đang thuộc combo khác' },
            { status: 400 }
          )
        }
      }

      // Soft delete
      await db.execute({
        sql: "UPDATE Product SET active = 0, updated_at = datetime('now') WHERE id = ?",
        args: [productId],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, created_at)
              VALUES (?, ?, ?, 'delete', 'product', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          productId,
          JSON.stringify(product),
        ],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã vô hiệu hóa sản phẩm',
      })
    } catch (err) {
      console.error('Delete product error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
