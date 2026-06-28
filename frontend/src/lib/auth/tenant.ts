export interface AuthUser {
  id: string
  username: string
  role: string
  tenantId: string | null
  active: boolean
}

export function getTenantId(user: AuthUser): string {
  if (user.role === 'super_admin' && !user.tenantId) {
    throw new Error('Super admin must specify tenantId in query params')
  }
  if (!user.tenantId) {
    throw new Error('Tenant ID required')
  }
  return user.tenantId
}
