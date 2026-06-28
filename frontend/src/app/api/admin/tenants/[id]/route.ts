import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

// PATCH /api/admin/tenants/[id] — Update tenant (super_admin only)
export const PATCH = withAuth(
  async (req, { user }) => {
    try {
      const tenantId = req.nextUrl.pathname.split('/').at(-1)!

      // 1. Verify tenant exists
      const existing = await db.execute({
        sql: 'SELECT * FROM Tenant WHERE id = ?',
        args: [tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      // 2. Parse body
      const body = await req.json()
      const allowedFields = ['name', 'slug', 'business_type', 'phone', 'email', 'address', 'logo_url', 'open_time', 'close_time', 'active', 'metadata']
      const updates: string[] = []
      const args: (string | number)[] = []

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`)
          args.push(typeof body[field] === 'object' ? JSON.stringify(body[field]) : body[field])
        }
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không có trường nào để cập nhật' },
          { status: 400 }
        )
      }

      // 3. If slug is being changed, check uniqueness
      if (body.slug !== undefined) {
        const slugCheck = await db.execute({
          sql: 'SELECT id FROM Tenant WHERE slug = ? AND id != ?',
          args: [body.slug, tenantId],
        })
        if (slugCheck.rows.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Slug đã tồn tại' },
            { status: 409 }
          )
        }
      }

      // 4. Execute update
      updates.push("updated_at = datetime('now')")
      args.push(tenantId)

      await db.execute({
        sql: `UPDATE Tenant SET ${updates.join(', ')} WHERE id = ?`,
        args,
      })

      // 5. Audit log
      const oldTenant = existing.rows[0]
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'tenant', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          tenantId,
          user.id,
          tenantId,
          JSON.stringify(body),
        ],
      })

      // 6. Fetch updated tenant
      const updated = await db.execute({
        sql: 'SELECT * FROM Tenant WHERE id = ?',
        args: [tenantId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update tenant error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)

// DELETE /api/admin/tenants/[id] — Soft delete tenant (super_admin only)
export const DELETE = withAuth(
  async (req, { user }) => {
    try {
      const tenantId = req.nextUrl.pathname.split('/').at(-1)!

      // 1. Verify tenant exists
      const existing = await db.execute({
        sql: 'SELECT id, active FROM Tenant WHERE id = ?',
        args: [tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      if (existing.rows[0].active === 0) {
        return NextResponse.json(
          { success: false, error: 'Tenant đã bị vô hiệu hóa' },
          { status: 400 }
        )
      }

      // 2. Soft delete: set active=0
      await db.execute({
        sql: "UPDATE Tenant SET active = 0, updated_at = datetime('now') WHERE id = ?",
        args: [tenantId],
      })

      // 3. Deactivate all users of this tenant
      await db.execute({
        sql: "UPDATE User SET active = 0, updated_at = datetime('now') WHERE tenant_id = ?",
        args: [tenantId],
      })

      // 4. Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, created_at)
              VALUES (?, ?, ?, 'delete', 'tenant', ?, datetime('now'))`,
        args: [randomUUID(), tenantId, user.id, tenantId],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã vô hiệu hóa tenant',
      })
    } catch (err) {
      console.error('Delete tenant error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)
