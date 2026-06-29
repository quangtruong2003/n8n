import { NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

export const GET = withAuth(async (_req, { user }) => {
  let tenant: Record<string, string> | null = null
  if (user.tenantId) {
    const tenantResult = await db.execute({
      sql: 'SELECT id, name, slug FROM Tenant WHERE id = ?',
      args: [user.tenantId],
    })
    if (tenantResult.rows.length > 0) {
      const t = tenantResult.rows[0]
      tenant = { id: String(t.id), name: String(t.name), slug: String(t.slug) }
    }
  }

  let roleInfo: { id: string; name: string; description: string } | null = null
  const userResult = await db.execute({
    sql: 'SELECT full_name FROM "User" WHERE id = ?',
    args: [user.id],
  })
  const fullName = userResult.rows.length > 0 ? String(userResult.rows[0].full_name || '') : null

  if (user.role && user.tenantId) {
    const roleResult = await db.execute({
      sql: 'SELECT id, name, description FROM Role WHERE name = ? AND tenant_id = ?',
      args: [user.role, user.tenantId],
    })
    if (roleResult.rows.length > 0) {
      const r = roleResult.rows[0]
      roleInfo = { id: String(r.id), name: String(r.name), description: String(r.description || '') }
    }
  }

  let permissions: string[] = []
  if (roleInfo) {
    const permResult = await db.execute({
      sql: 'SELECT resource, can_view, can_create, can_edit, can_delete FROM Permission WHERE role_id = ?',
      args: [roleInfo.id],
    })
    permissions = permResult.rows.flatMap((row) => {
      const grants: string[] = []
      if (row.can_view === 1) grants.push(`${row.resource}:view`)
      if (row.can_create === 1) grants.push(`${row.resource}:create`)
      if (row.can_edit === 1) grants.push(`${row.resource}:edit`)
      if (row.can_delete === 1) grants.push(`${row.resource}:delete`)
      return grants
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
        active: true,
        fullName,
      },
      tenant,
      role: roleInfo,
      permissions,
    },
  })
})
