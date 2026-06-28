import { randomUUID } from 'crypto'
import { db } from './db'

export async function auditLog(params: {
  tenantId: string
  userId: string
  action: 'create' | 'update' | 'delete' | 'login' | 'logout'
  entityType: string
  entityId?: string
  oldValue?: object
  newValue?: object
  ipAddress?: string
}): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        params.tenantId,
        params.userId,
        params.action,
        params.entityType,
        params.entityId ?? null,
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
        params.ipAddress ?? null,
      ],
    })
  } catch {
    // Silent fail - audit log must not break business operations
  }
}
