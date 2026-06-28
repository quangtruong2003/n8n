import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// PUT /api/roles/{id} — Update role
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const roleId = req.nextUrl.pathname.split('/').at(-1)!

      // 1. Verify role exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM Role WHERE id = ? AND tenant_id = ?',
        args: [roleId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy vai trò' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const { name, description } = body as { name?: string; description?: string }

      // Validate name if provided
      if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        return NextResponse.json(
          { success: false, error: 'Tên vai trò không hợp lệ' },
          { status: 400 }
        )
      }

      // Build dynamic update
      const updates: string[] = []
      const args: (string | number | null)[] = []

      if (name !== undefined) {
        // Check unique constraint (tenant_id, name) excluding current role
        const dup = await db.execute({
          sql: 'SELECT id FROM Role WHERE tenant_id = ? AND name = ? AND id != ?',
          args: [user.tenantId, name.trim(), roleId],
        })
        if (dup.rows.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Tên vai trò đã tồn tại' },
            { status: 409 }
          )
        }
        updates.push('name = ?')
        args.push(name.trim())
      }

      if (description !== undefined) {
        updates.push('description = ?')
        args.push(description || null)
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không có trường nào để cập nhật' },
          { status: 400 }
        )
      }

      updates.push("updated_at = datetime('now')")
      args.push(roleId)

      await db.execute({
        sql: `UPDATE Role SET ${updates.join(', ')} WHERE id = ?`,
        args,
      })

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'role', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          roleId,
          JSON.stringify(existing.rows[0]),
          JSON.stringify(body),
        ],
      })

      const updated = await db.execute({
        sql: 'SELECT * FROM Role WHERE id = ?',
        args: [roleId],
      })

      return NextResponse.json({
        success: true,
        data: updated.rows[0],
      })
    } catch (err) {
      console.error('Update role error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)

// DELETE /api/roles/{id} — Delete role (hard delete, guarded)
export const DELETE = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      const roleId = req.nextUrl.pathname.split('/').at(-1)!

      // 1. Verify role exists and belongs to tenant
      const existing = await db.execute({
        sql: 'SELECT * FROM Role WHERE id = ? AND tenant_id = ?',
        args: [roleId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy vai trò' },
          { status: 404 }
        )
      }

      const role = existing.rows[0]

      // 2. Cannot delete if users are assigned to this role
      const userCount = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM User WHERE role = ? AND tenant_id = ?',
        args: [role.name, user.tenantId],
      })
      if ((userCount.rows[0].total as number) > 0) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa vai trò đang được gán cho người dùng' },
          { status: 400 }
        )
      }

      // 3. Delete associated permissions first
      await db.execute({
        sql: 'DELETE FROM Permission WHERE role_id = ?',
        args: [roleId],
      })

      // 4. Delete the role
      await db.execute({
        sql: 'DELETE FROM Role WHERE id = ?',
        args: [roleId],
      })

      // 5. Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, created_at)
              VALUES (?, ?, ?, 'delete', 'role', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          roleId,
          JSON.stringify(role),
        ],
      })

      return NextResponse.json({
        success: true,
        message: 'Đã xóa vai trò',
      })
    } catch (err) {
      console.error('Delete role error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
