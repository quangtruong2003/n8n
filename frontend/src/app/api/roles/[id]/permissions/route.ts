import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

// PUT /api/roles/{id}/permissions — Bulk update permissions for a role
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      // Extract roleId from path: /api/roles/[id]/permissions
      const pathParts = req.nextUrl.pathname.split('/')
      const roleId = pathParts[pathParts.length - 2]!

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
      const { permissions } = body as {
        permissions?: Array<{
          resource: string
          can_view?: boolean | number
          can_create?: boolean | number
          can_edit?: boolean | number
          can_delete?: boolean | number
        }>
      }

      // 2. Validate permissions array
      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, error: 'permissions phải là mảng' },
          { status: 400 }
        )
      }

      for (const perm of permissions) {
        if (!perm.resource || typeof perm.resource !== 'string' || perm.resource.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: 'Mỗi quyền phải có resource hợp lệ' },
            { status: 400 }
          )
        }
      }

      // 3. Build batch: delete existing + insert new
      const statements: Array<{ sql: string; args: (string | number | null)[] }> = []

      // Delete all existing permissions for this role
      statements.push({
        sql: 'DELETE FROM Permission WHERE role_id = ?',
        args: [roleId],
      })

      // Insert new permissions
      for (const perm of permissions) {
        const permId = randomUUID()
        statements.push({
          sql: `INSERT INTO Permission (id, role_id, resource, can_view, can_create, can_edit, can_delete)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            permId,
            roleId,
            perm.resource.trim(),
            perm.can_view ? 1 : 0,
            perm.can_create ? 1 : 0,
            perm.can_edit ? 1 : 0,
            perm.can_delete ? 1 : 0,
          ],
        })
      }

      // 4. Execute as transaction
      await db.batch(
        statements.map((s) => ({ sql: s.sql, args: s.args })),
        'write'
      )

      // 5. Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'role_permissions', ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          roleId,
          JSON.stringify({ role_id: roleId, permissions }),
        ],
      })

      // 6. Return updated permissions
      const result = await db.execute({
        sql: 'SELECT * FROM Permission WHERE role_id = ? ORDER BY resource ASC',
        args: [roleId],
      })

      return NextResponse.json({
        success: true,
        data: result.rows,
      })
    } catch (err) {
      console.error('Update role permissions error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
