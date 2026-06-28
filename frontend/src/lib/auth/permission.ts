import { db } from '../db'

const ACTION_COLUMN_MAP: Record<string, string> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
}

/**
 * Check whether a user has permission to perform an action on a resource.
 *
 * - super_admin / owner → always true (full access)
 * - staff → lookup Permission table via Role (matched by tenant + role name)
 */
export async function checkPermission(
  userId: string,
  tenantId: string,
  resource: string,
  action: 'view' | 'create' | 'edit' | 'delete'
): Promise<boolean> {
  // 1. Look up user to determine role
  const userResult = await db.execute({
    sql: 'SELECT role FROM User WHERE id = ? AND tenant_id = ?',
    args: [userId, tenantId],
  })

  if (userResult.rows.length === 0) {
    return false
  }

  const userRole = userResult.rows[0].role as string

  // 2. super_admin and owner have full access
  if (userRole === 'super_admin' || userRole === 'owner') {
    return true
  }

  // 3. staff: find the Role row for this tenant, then check Permission
  const column = ACTION_COLUMN_MAP[action]
  if (!column) {
    return false
  }

  const permResult = await db.execute({
    sql: `
      SELECT p.${column} AS allowed
      FROM Permission p
      INNER JOIN Role r ON r.id = p.role_id
      WHERE r.tenant_id = ?
        AND r.name = ?
        AND p.resource = ?
      LIMIT 1
    `,
    args: [tenantId, userRole, resource],
  })

  if (permResult.rows.length === 0) {
    return false
  }

  return (permResult.rows[0].allowed as number) === 1
}
