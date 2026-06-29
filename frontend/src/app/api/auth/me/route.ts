import { NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

export const GET = withAuth(async (_req, { user }) => {
  // 1. Fetch tenant info
  let tenant = null
  if (user.tenantId) {
    const tenantResult = await db.execute({
      sql: 'SELECT id, name, slug FROM Tenant WHERE id = ?',
      args: [user.tenantId],
    })
    if (tenantResult.rows.length > 0) {
      const t = tenantResult.rows[0]
      tenant = { id: t.id, name: t.name, slug: t.slug }
    }
  }

  // 2. Fetch role info
  let roleInfo = null
  // Get fullName from User table
  const userResult = await db.execute({
    sql: 'SELECT full_name FROM "User" WHERE id = ?',
    args: [user.id],
  })
  const fullName = userResult.rows.length > 0 ? userResult.rows[0].full_name : null

  // 2. Fetch role info
  const roleResult = await db.execute({
    sql: 'SELECT id, name, description FROM Role WHERE name = ? AND tenant_id = ?',
    args: [user.role, user.tenantId],
  })
  if (roleResult.rows.length > 0) {
    const r = roleResult.rows[0]
    roleInfo = { id: r.id, name: r.name, description: r.description }
  }

  // 3. Fetch permissions
  let permissions: string[] = []
  if (roleInfo) {
    const permResult = await db.execute({
      sql: 'SELECT resource, can_view, can_create, can_edit, can_delete FROM Permission WHERE role_id = ?',
      args: [roleInfo.id],
    })
    permissions = permResult.rows.flatMap((row: Record<string, unknown>) => {
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
