import { randomUUID } from 'crypto'
import { Zalo, ThreadType } from 'zca-js'
import { db } from '../db'
import { processMessage } from './chat-service'

// ─── Singleton Map ──────────────────────────────────────────

interface ZaloInstance {
  api: any
  zalo: Zalo
}

const zaloInstances = new Map<string, ZaloInstance>()

// ─── Health Check (every 5 min) ─────────────────────────────

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000

let healthTimer: ReturnType<typeof setInterval> | null = null

function startHealthCheck() {
  if (healthTimer) return
  healthTimer = setInterval(async () => {
    for (const [tenantId, instance] of zaloInstances) {
      try {
        const ownId = instance.api.getOwnId()
        if (!ownId) throw new Error('No ownId')
      } catch {
        console.warn(`[Zalo] Connection lost for tenant ${tenantId}, reconnecting...`)
        await reconnectZalo(tenantId)
      }
    }
  }, HEALTH_CHECK_INTERVAL)
}

async function reconnectZalo(tenantId: string) {
  try {
    const existing = zaloInstances.get(tenantId)
    if (!existing) return

    // Attempt re-login with same Zalo instance
    const cookies = existing.zalo.getCookies?.() ?? null
    if (!cookies) {
      console.error(`[Zalo] No cached cookies for tenant ${tenantId}, cannot reconnect`)
      return
    }

    const api = await existing.zalo.login({
      cookie: cookies,
      imei: '',
      userAgent: '',
    })

    zaloInstances.set(tenantId, { api, zalo: existing.zalo })
    setupListener(tenantId, api)
    api.listener.start()
    console.log(`[Zalo] Reconnected tenant ${tenantId}`)
  } catch (err) {
    console.error(`[Zalo] Reconnect failed for tenant ${tenantId}:`, err)
    zaloInstances.delete(tenantId)
    await db.execute({
      sql: `UPDATE BotConfig SET zalo_connected = 0 WHERE tenant_id = ?`,
      args: [tenantId],
    })
  }
}

// ─── Listener ───────────────────────────────────────────────

function setupListener(tenantId: string, api: any) {
  api.listener.on('message', async (message: any) => {
    if (message.isSelf) return
    if (typeof message.data?.content !== 'string') return

    switch (message.type) {
      case ThreadType.User:
        await handleZaloMessage(tenantId, message)
        break
      case ThreadType.Group:
        // Skip group chat for MVP
        break
    }
  })
}

// ─── Message Handler ────────────────────────────────────────

async function handleZaloMessage(tenantId: string, message: any) {
  const threadId = String(message.threadId)
  const content = message.data.content as string
  const senderName = message.data?.dName ?? 'Zalo User'

  try {
    // 1. Find or create Customer by zalo threadId
    const existingCustomer = await db.execute({
      sql: `SELECT id FROM Customer WHERE spa_id = ? AND phone = ? LIMIT 1`,
      args: [tenantId, `zalo:${threadId}`],
    })

    let customerId: string
    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id as string
    } else {
      customerId = randomUUID()
      await db.execute({
        sql: `INSERT INTO Customer (id, name, phone, spa_id) VALUES (?, ?, ?, ?)`,
        args: [customerId, senderName, `zalo:${threadId}`, tenantId],
      })
    }

    // 2. Find or create ChatSession (channel=zalo)
    const existingSession = await db.execute({
      sql: `SELECT id FROM ChatSession WHERE tenant_id = ? AND channel = 'zalo' AND metadata LIKE ? LIMIT 1`,
      args: [tenantId, `%${threadId}%`],
    })

    let sessionId: string
    if (existingSession.rows.length > 0) {
      sessionId = existingSession.rows[0].id as string
    } else {
      sessionId = randomUUID()
      await db.execute({
        sql: `INSERT INTO ChatSession (id, tenant_id, customer_id, channel, status, metadata, last_message_at, created_at, updated_at) VALUES (?, ?, ?, 'zalo', 'active', ?, datetime('now'), datetime('now'), datetime('now'))`,
        args: [
          sessionId,
          tenantId,
          customerId,
          JSON.stringify({ zalo_thread_id: threadId }),
        ],
      })
    }

    // 3. Cross-channel context: look for recent web session
    let previousContext: string | undefined
    const recentWebSession = await db.execute({
      sql: `SELECT id, last_message_at FROM ChatSession WHERE tenant_id = ? AND customer_id = ? AND channel = 'web' AND last_message_at >= datetime('now', '-24 hours') ORDER BY last_message_at DESC LIMIT 1`,
      args: [tenantId, customerId],
    })

    if (recentWebSession.rows.length > 0) {
      const webSessionId = recentWebSession.rows[0].id as string
      const webMessages = await db.execute({
        sql: `SELECT content FROM ChatMessage WHERE session_id = ? ORDER BY created_at DESC LIMIT 5`,
        args: [webSessionId],
      })
      if (webMessages.rows.length > 0) {
        const topics = webMessages.rows
          .map((r) => r.content as string)
          .reverse()
          .join('; ')
        previousContext = `Khách đã chat trên web trước đó. Nội dung gần nhất: ${topics}`
      }
    }

    // 4. Process message via chat-service
    const result = await processMessage({
      tenantId,
      sessionId,
      customerId,
      channel: 'zalo',
      userMessage: content,
      previousContext,
    })

    // 4. Send reply
    if (result.reply) {
      await api.sendMessage(result.reply, threadId, ThreadType.User)
    }
  } catch (err) {
    console.error(`[Zalo] Error handling message for tenant ${tenantId}:`, err)
  }
}

// ─── Public API ─────────────────────────────────────────────

export async function connectZalo(
  tenantId: string,
  cookies: object,
  imei: string,
  userAgent: string,
): Promise<boolean> {
  try {
    const zalo = new Zalo({ selfListen: false })
    const api = await zalo.login({ cookie: cookies, imei, userAgent })

    zaloInstances.set(tenantId, { api, zalo })
    setupListener(tenantId, api)
    api.listener.start()

    // Save cookies for reconnect
    const cookiePath = `${process.cwd()}/.zalo-cookies/${tenantId}.json`
    const fs = await import('fs/promises')
    await fs.mkdir(`${process.cwd()}/.zalo-cookies`, { recursive: true })
    await fs.writeFile(cookiePath, JSON.stringify(cookies), 'utf-8')

    // Update BotConfig
    await db.execute({
      sql: `UPDATE BotConfig SET zalo_connected = 1, zalo_account_name = ? WHERE tenant_id = ?`,
      args: [api.getOwnId() ?? 'unknown', tenantId],
    })

    startHealthCheck()
    console.log(`[Zalo] Connected tenant ${tenantId}`)
    return true
  } catch (err) {
    console.error(`[Zalo] Connect failed for tenant ${tenantId}:`, err)
    await db.execute({
      sql: `UPDATE BotConfig SET zalo_connected = 0 WHERE tenant_id = ?`,
      args: [tenantId],
    })
    return false
  }
}

export function disconnectZalo(tenantId: string): void {
  const instance = zaloInstances.get(tenantId)
  if (instance) {
    try {
      instance.api.listener.stop?.()
    } catch {
      // ignore stop errors
    }
    zaloInstances.delete(tenantId)
  }

  db.execute({
    sql: `UPDATE BotConfig SET zalo_connected = 0 WHERE tenant_id = ?`,
    args: [tenantId],
  }).catch((err) => console.error(`[Zalo] Failed to update disconnect status:`, err))

  // Clean up health check if no instances left
  if (zaloInstances.size === 0 && healthTimer) {
    clearInterval(healthTimer)
    healthTimer = null
  }
}

export function getZaloStatus(tenantId: string): { connected: boolean; accountName?: string } {
  const instance = zaloInstances.get(tenantId)
  if (!instance) return { connected: false }

  try {
    const ownId = instance.api.getOwnId()
    return { connected: true, accountName: ownId ?? undefined }
  } catch {
    return { connected: false }
  }
}

export async function sendZaloMessage(
  tenantId: string,
  threadId: string,
  message: string,
  type: ThreadType = ThreadType.User,
): Promise<boolean> {
  const instance = zaloInstances.get(tenantId)
  if (!instance) return false

  try {
    await instance.api.sendMessage(message, threadId, type)
    return true
  } catch (err) {
    console.error(`[Zalo] Send failed for tenant ${tenantId}:`, err)
    return false
  }
}
