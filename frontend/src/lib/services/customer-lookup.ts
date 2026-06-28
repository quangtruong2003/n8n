import { db } from '../db'

interface Customer {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  email: string | null
  gender: string | null
  date_of_birth: string | null
  address: string | null
  notes: string | null
  tags: string
  metadata: string
  active: number
  created_at: string
  updated_at: string
}

/**
 * Normalize phone number for consistent lookup:
 * - Remove spaces, dashes, dots
 * - Convert +84 prefix to 0
 */
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-\.]/g, '')

  if (normalized.startsWith('+84')) {
    normalized = '0' + normalized.slice(3)
  }

  return normalized
}

/**
 * Find an active customer by phone number.
 * Used by:
 * - Zalo message handler (find customer from Zalo phone)
 * - Web -> Zalo handoff (customer sends phone in web chat)
 * - Booking API (customer books via phone)
 */
export async function findCustomerByPhone(
  tenantId: string,
  phone: string
): Promise<Customer | null> {
  const normalized = normalizePhone(phone)

  const result = await db.execute({
    sql: 'SELECT * FROM Customer WHERE tenant_id = ? AND phone = ? AND active = 1',
    args: [tenantId, normalized],
  })

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0] as unknown as Customer
}
