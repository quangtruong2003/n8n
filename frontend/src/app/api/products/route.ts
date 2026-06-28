import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

const VALID_TYPES = ['service', 'product', 'combo']

// GET /api/products — List products with filters
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

    const type = url.searchParams.get('type')
    const categoryId = url.searchParams.get('category_id')
    const active = url.searchParams.get('active')
    const search = url.searchParams.get('search')

    const conditions: string[] = ['p.tenant_id = ?']
    const args: (string | number)[] = [user.tenantId]

    if (type) {
      conditions.push('p.type = ?')
      args.push(type)
    }

    if (categoryId) {
      conditions.push('p.category_id = ?')
      args.push(categoryId)
    }

    if (active !== null && active !== undefined && active !== '') {
      conditions.push('p.active = ?')
      args.push(parseInt(active, 10))
    }

    if (search) {
      conditions.push('p.name LIKE ?')
      args.push(`%${search}%`)
    }

    const where = conditions.join(' AND ')

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM Product p WHERE ${where}`,
      args,
    })
    const total = (countResult.rows[0].total as number) || 0

    const countArgs = [...args, limit, offset]
    const result = await db.execute({
      sql: `SELECT p.*, pc.name as category_name
            FROM Product p
            LEFT JOIN ProductCategory pc ON pc.id = p.category_id
            WHERE ${where}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?`,
      args: countArgs,
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (err) {
    console.error('List products error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// POST /api/products — Create product
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
      const { name, type, category_id, price, description, duration_minutes } = body
      const combo_items = body.combo_items as { product_id: string; quantity: number }[] | undefined

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Tên sản phẩm là bắt buộc' },
          { status: 400 }
        )
      }

      if (!type || !VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { success: false, error: 'Loại không hợp lệ (service, product, combo)' },
          { status: 400 }
        )
      }

      if (price === undefined || price === null || typeof price !== 'number' || price < 0) {
        return NextResponse.json(
          { success: false, error: 'Giá không hợp lệ' },
          { status: 400 }
        )
      }

      // Validate category belongs to same tenant
      if (category_id) {
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

      // Validate combo items if type is combo
      if (type === 'combo') {
        if (!combo_items || !Array.isArray(combo_items) || combo_items.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Combo phải có ít nhất 1 sản phẩm/dịch vụ' },
            { status: 400 }
          )
        }

        for (const item of combo_items) {
          if (!item.product_id || !item.quantity || item.quantity < 1) {
            return NextResponse.json(
              { success: false, error: 'Combo item không hợp lệ (cần product_id và quantity >= 1)' },
              { status: 400 }
            )
          }

          // Validate product belongs to same tenant
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

        // Check for duplicate product_ids in combo
        const productIds = combo_items.map((ci) => ci.product_id)
        if (new Set(productIds).size !== productIds.length) {
          return NextResponse.json(
            { success: false, error: 'Combo chứa sản phẩm trùng lặp' },
            { status: 400 }
          )
        }
      }

      const productId = randomUUID()

      await db.execute({
        sql: `INSERT INTO Product (id, tenant_id, category_id, name, type, description, price, duration_minutes, active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        args: [
          productId,
          user.tenantId,
          category_id || null,
          name.trim(),
          type,
          description || null,
          price,
          duration_minutes || null,
        ],
      })

      // Insert combo items
      if (type === 'combo' && combo_items && combo_items.length > 0) {
        for (const item of combo_items) {
          await db.execute({
            sql: `INSERT INTO ComboItem (id, combo_id, product_id, quantity) VALUES (?, ?, ?, ?)`,
            args: [randomUUID(), productId, item.product_id, item.quantity],
          })
        }
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'product', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          productId,
          JSON.stringify({ name: name.trim(), type, category_id, price, description, duration_minutes }),
        ],
      })

      const created = await db.execute({
        sql: 'SELECT * FROM Product WHERE id = ?',
        args: [productId],
      })

      return NextResponse.json({
        success: true,
        data: created.rows[0],
      }, { status: 201 })
    } catch (err) {
      console.error('Create product error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
