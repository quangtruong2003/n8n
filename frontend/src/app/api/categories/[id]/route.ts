import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// PUT /api/categories/{id} — Update category
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const categoryId = req.nextUrl.pathname.split('/').at(-1)!

      // Verify category exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM ProductCategory WHERE id = ? AND tenant_id = ? AND active = 1',
        args: [categoryId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy danh mục' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const { name, parent_id, sort_order, description } = body

      // If changing parent, validate depth
      if (parent_id !== undefined && parent_id !== null) {
        // Cannot set parent to self
        if (parent_id === categoryId) {
          return NextResponse.json(
            { success: false, error: 'Không thể đặt danh mục làm cha của chính nó' },
            { status: 400 }
          )
        }

        // Check parent exists and belongs to same tenant
        const parent = await db.execute({
          sql: 'SELECT id FROM ProductCategory WHERE id = ? AND tenant_id = ? AND active = 1',
          args: [parent_id, user.tenantId],
        })

        if (parent.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Danh mục cha không tồn tại' },
            { status: 400 }
          )
        }

        // Check depth: calculate parent's depth
        let depth = 0
        let currentId: string | null = parent_id
        while (currentId) {
          if (currentId === categoryId) {
            return NextResponse.json(
              { success: false, error: 'Không thể tạo vòng lặp danh mục' },
              { status: 400 }
            )
          }
          const row = await db.execute({
            sql: 'SELECT parent_id FROM ProductCategory WHERE id = ? AND tenant_id = ?',
            args: [currentId, user.tenantId],
          })
          if (row.rows.length === 0) break
          currentId = row.rows[0].parent_id as string | null
          if (currentId) depth++
        }

        if (depth + 1 > 2) {
          return NextResponse.json(
            { success: false, error: 'Không thể chuyển danh mục quá 3 cấp' },
            { status: 400 }
          )
        }
      }

      const allowedFields = ['name', 'parent_id', 'sort_order', 'description']
      const updates: string[] = []
      const args: (string | number | null)[] = []

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

      args.push(categoryId)

      await db.execute({
        sql: `UPDATE ProductCategory SET ${updates.join(', ')} WHERE id = ?`,
        args,
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'product_category', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          categoryId,
          JSON.stringify(existing.rows[0]),
          JSON.stringify(body),
        ],
      })

      const updated = await db.execute({
        sql: 'SELECT * FROM ProductCategory WHERE id = ?',
        args: [categoryId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update category error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)

// DELETE /api/categories/{id} — Delete category (soft delete)
export const DELETE = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const categoryId = req.nextUrl.pathname.split('/').at(-1)!

      // Verify category exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM ProductCategory WHERE id = ? AND tenant_id = ? AND active = 1',
        args: [categoryId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy danh mục' },
          { status: 404 }
        )
      }

      // Cannot delete if category has child categories
      const childCount = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM ProductCategory WHERE parent_id = ? AND active = 1',
        args: [categoryId],
      })
      if ((childCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa danh mục còn danh mục con' },
          { status: 400 }
        )
      }

      // Cannot delete if category has products
      const productCount = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM Product WHERE category_id = ? AND active = 1',
        args: [categoryId],
      })
      if ((productCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa danh mục còn sản phẩm' },
          { status: 400 }
        )
      }

      // Soft delete
      await db.execute({
        sql: "UPDATE ProductCategory SET active = 0 WHERE id = ?",
        args: [categoryId],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, created_at)
              VALUES (?, ?, ?, 'delete', 'product_category', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          categoryId,
          JSON.stringify(existing.rows[0]),
        ],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã xóa danh mục',
      })
    } catch (err) {
      console.error('Delete category error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
