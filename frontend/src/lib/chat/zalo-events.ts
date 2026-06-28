import { db } from '../db'

/**
 * Register non-message Zalo event handlers on an existing api instance.
 * Call after `api.listener.start()`.
 */
export function setupZaloEvents(api: any, tenantId: string): void {
  // ─── Message Read Receipt ────────────────────────────────────
  api.listener.on('message_read', async (data: any) => {
    try {
      const threadId = data?.threadId ? String(data.threadId) : null
      if (!threadId) return

      // Mark all unread messages for this thread as read
      await db.execute({
        sql: `UPDATE ChatMessage
               SET read_at = datetime('now')
               WHERE tenant_id = ?
                 AND channel = 'zalo'
                 AND direction = 'outbound'
                 AND read_at IS NULL
                 AND session_id IN (
                   SELECT id FROM ChatSession
                   WHERE tenant_id = ?
                     AND channel = 'zalo'
                     AND metadata LIKE ?
                 )`,
        args: [tenantId, tenantId, `%${threadId}%`],
      })
    } catch (err) {
      console.error(`[Zalo] message_read handler error for tenant ${tenantId}:`, err)
    }
  })

  // ─── Typing Indicator ────────────────────────────────────────
  api.listener.on('typing', (data: any) => {
    // Logged for future dashboard "user is typing..." display
    console.log(`[Zalo] typing event tenant=${tenantId}`, data?.threadId ?? '')
  })

  // ─── Group Events (MVP skip) ────────────────────────────────
  api.listener.on('group_event', (data: any) => {
    console.log(`[Zalo] group_event (skipped) tenant=${tenantId}`, data?.type ?? 'unknown')
  })
}
