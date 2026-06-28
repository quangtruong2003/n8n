import { runMigration } from './migrate'
import { db } from './db'
import { decrypt } from './chat/zalo-crypto'
import { connectZalo } from './chat/zalo'

interface BotConfigRow {
  tenant_id: string
  zalo_cookies: string
  zalo_imei: string | null
  zalo_user_agent: string | null
}

export async function initializeServices(): Promise<void> {
  console.log('[Startup] Running migration 001...')
  await runMigration('001')
  console.log('[Startup] Migration complete.')

  await initAllZaloConnections()
}

async function initAllZaloConnections(): Promise<void> {
  const result = await db.execute(
    `SELECT tenant_id, zalo_cookies, zalo_imei, zalo_user_agent
     FROM BotConfig
     WHERE zalo_connected = 1 AND zalo_cookies IS NOT NULL`
  )

  const tenants = result.rows as unknown as BotConfigRow[]

  if (tenants.length === 0) {
    console.log('[Zalo] No tenants to reconnect.')
    return
  }

  let connected = 0

  for (const tenant of tenants) {
    const { tenant_id, zalo_cookies, zalo_imei, zalo_user_agent } = tenant
    try {
      const decryptedCookies = decrypt(zalo_cookies)
      const cookies = JSON.parse(decryptedCookies)

      const ok = await connectZalo(
        tenant_id,
        cookies,
        zalo_imei ?? '',
        zalo_user_agent ?? ''
      )

      if (ok) {
        connected++
        console.log(`[Zalo] Tenant ${tenant_id} reconnected.`)
      } else {
        console.warn(`[Zalo] Tenant ${tenant_id} connect returned false.`)
      }
    } catch (err) {
      console.error(`[Zalo] Tenant ${tenant_id} reconnect failed:`, err)
      await db.execute({
        sql: `UPDATE BotConfig SET zalo_connected = 0 WHERE tenant_id = ?`,
        args: [tenant_id],
      })
    }
  }

  console.log(`[Zalo] ${connected}/${tenants.length} tenants connected.`)
}
