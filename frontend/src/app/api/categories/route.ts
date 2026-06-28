import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

interface CategoryRow {
  id: string
  tenant_id: string
  parent_id: string | null
  name: string
  description: string | null
  sort_order: number
  active: number
  created_at: string
}

interface CategoryNode extends CategoryRow {
  children: CategoryNode[]
}

function buildTree(rows: CategoryRow[], parentId: string | null = null): CategoryNode[] {
  return rows
    .filter((r) => r.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((r) => ({
      ...r,
      children: buildTree(rows, r.id),
    }))
}

async function getDepth(categoryId: string, tenantId: string): Promise<number> {
  let depth = 0
  let currentId: string | null = categoryId

  while (currentId) {
    const result = await db.execute({
      sql: 'SELECT parent_id FROM ProductCategory WHERE id = ? AND tenant_id = ?',
      args: [currentId, tenantId],
    })
    if (result.rows.length === 0) break
    currentId = result.rows[0].parent_id as string | null
    if (currentId) depth++
  }

  return depth
}

// GET /api/categories — List categories as tree
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const result = await db.execute({
      sql: `SELECT id, tenant_id, parent_id, name, description, sort_order, active, created_at
            FROM ProductCategory
            WHERE tenant_id = ? AND active = 1
            ORDER BY sort_order ASC, name ASC`,
      args: [user.tenantId],
    })

    const rows = result.rows as unknown as CategoryRow[]
    const tree = buildTree(rows)

    return NextResponse.json({
      success: true,
      data: tree,
    })
  } catch (err) {
    console.error('List categories error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// POST /api/categories — Create category
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
      const { name, parent_id, sort_order, description } = body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Tên danh mục là bắt buộc' },
          { status: 400 }
        )
      }

      if (parent_id) {
        // Check parent exists and belongs to same tenant
        const parent = await db.execute({
          sql: 'SELECT id, parent_id FROM ProductCategory WHERE id = ? AND tenant_id = ? AND active = 1',
          args: [parent_id, user.tenantId],
        })

        if (parent.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Danh mục cha không tồn tại' },
            { status: 400 }
          )
        }

        // Check depth: parent's depth + 1 must be <= 2 (max 3 levels: 0, 1, 2)
        const parentDepth = await getDepth(parent_id, user.tenantId)
        if (parentDepth + 1 > 2) {
          return NextResponse.json(
            { success: false, error: 'Không thể tạo danh mục quá 3 cấp' },
            { status: 400 }
          )
        }
      }

      const categoryId = randomUUID()

      await db.execute({
        sql: `INSERT INTO ProductCategory (id, tenant_id, parent_id, name, description, sort_order, active, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        args: [
          categoryId,
          user.tenantId,
          parent_id || null,
          name.trim(),
          description || null,
          sort_order ?? 0,
        ],
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'create', 'product_category', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          categoryId,
          JSON.stringify({ name: name.trim(), parent_id: parent_id || null, sort_order: sort_order ?? 0 }),
        ],
      })

      const created = await db.execute({
        sql: 'SELECT * FROM ProductCategory WHERE id = ?',
        args: [categoryId],
      })

      return NextResponse.json({
        success: true,
        data: created.rows[0],
      }, { status: 201 })
    } catch (err) {
      console.error('Create category error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
