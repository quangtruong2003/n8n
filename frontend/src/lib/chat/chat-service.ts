import { randomUUID } from 'crypto'
import { db } from '../db'
import { buildAIContext } from './context'
import { chatCompletion } from './openrouter'
import { findCustomerByPhone } from '../services/customer-lookup'

// ─── Intent Detection ────────────────────────────────────────

const HANDOFF_PATTERNS = [
  /nói\s*chuyện\s*với\s*người/i,
  /gọi\s*nhân\s*viên/i,
  /không\s*muốn\s*chat\s*với\s*bot/i,
  /bot\s*ng[uư]/i,
  /trả\s*lời\s*linh\s*tinh/i,
  /không\s*hiểu\s*g[ìì]/i,
  /human\s*đâu/i,
  /tôi\s*cần\s*tư\s*vấn\s*thật/i,
  /chuyển\s*máy\s*cho\s*người/i,
  /nói\s*chuyện\s*với\s*nhân\s*viên/i,
  /muốn\s*nói\s*với\s*người\s*thật/i,
  /chán\s*bot/i,
  /bot\s*không\s*biết\s*g[ìì]/i,
]

const BOOKING_PATTERNS = [
  /đặt\s*lịch/i,
  /book\s*appointment/i,
  /hẹn\s*lịch/i,
  /đăng?\s*ký\s*lịch/i,
  /muốn\s*đặt/i,
  /đặt\s*chỗ/i,
]

function detectIntent(message: string): 'handoff' | 'booking' | null {
  for (const p of HANDOFF_PATTERNS) {
    if (p.test(message)) return 'handoff'
  }
  for (const p of BOOKING_PATTERNS) {
    if (p.test(message)) return 'booking'
  }
  return null
}

// ─── Working Hours ───────────────────────────────────────────

function isWithinWorkingHours(openTime: string, closeTime: string): boolean {
  const now = new Date()
  const vnHour = (now.getUTCHours() + 7) % 24
  const vnMinute = now.getUTCMinutes()
  const currentMinutes = vnHour * 60 + vnMinute

  const [openH, openM] = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes
}

// ─── Types ──────────────────────────────────────────────────

interface ProcessMessageParams {
  tenantId: string
  sessionId: string
  customerId?: string
  channel: 'zalo' | 'web'
  userMessage: string
  previousContext?: string
}

interface ProcessMessageResult {
  reply: string
  shouldHandoffToStaff: boolean
}

interface BotConfigRow {
  ai_enabled: number
  working_hours_only: number
  ai_model: string | null
}

interface TenantRow {
  open_time: string | null
  close_time: string | null
}

interface ChatMessageRow {
  sender: string
  content: string
}

// ─── Main ───────────────────────────────────────────────────

export async function processMessage(
  params: ProcessMessageParams,
): Promise<ProcessMessageResult> {
  const { tenantId, sessionId, customerId, channel, userMessage, previousContext } = params

  // 1. Get BotConfig
  const configResult = await db.execute({
    sql: `SELECT ai_enabled, working_hours_only, ai_model FROM BotConfig WHERE tenant_id = ?`,
    args: [tenantId],
  })
  const config = configResult.rows[0] as unknown as BotConfigRow | undefined

  if (!config) {
    return { reply: 'Cấu hình chưa được thiết lập.', shouldHandoffToStaff: false }
  }

  // 2. Check ai_enabled
  if (config.ai_enabled === 0) {
    return {
      reply: 'Nhân viên sẽ phản hồi sớm.',
      shouldHandoffToStaff: false,
    }
  }

  // 3. Check working_hours_only
  if (config.working_hours_only === 1) {
    const tenantResult = await db.execute({
      sql: `SELECT open_time, close_time FROM Tenant WHERE id = ?`,
      args: [tenantId],
    })
    const tenant = tenantResult.rows[0] as unknown as TenantRow | undefined

    if (
      tenant?.open_time &&
      tenant?.close_time &&
      !isWithinWorkingHours(tenant.open_time, tenant.close_time)
    ) {
      return {
        reply: `Cảm ơn bạn đã liên hệ. Giờ làm việc của chúng tôi là ${tenant.open_time} - ${tenant.close_time}. Nhân viên sẽ phản hồi trong giờ làm việc.`,
        shouldHandoffToStaff: false,
      }
    }
  }

  // 4. Get chat history (10 most recent)
  const historyResult = await db.execute({
    sql: `SELECT sender, content FROM ChatMessage WHERE session_id = ? ORDER BY created_at DESC LIMIT 10`,
    args: [sessionId],
  })
  const history = (historyResult.rows as unknown as ChatMessageRow[]).reverse()

  // 5. Build AI context
  const contextMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = await buildAIContext(tenantId, previousContext) as any

  // 6. Append history + user message
  for (const msg of history) {
    contextMessages.push({
      role: (msg.sender === 'customer' ? 'user' : 'assistant') as 'system' | 'user' | 'assistant',
      content: msg.content,
    })
  }
  contextMessages.push({ role: 'user', content: userMessage })

  // 6.1 Phone detection
  const phoneMatch = userMessage.match(/(0|\+84)[0-9]{9,10}/g)
  let detectedPhone: string | null = null
  let overrideReply: string | null = null

  if (phoneMatch) {
    const rawPhone = phoneMatch[0]
    const normalizedPhone = rawPhone.startsWith('+84')
      ? '0' + rawPhone.slice(3)
      : rawPhone.replace(/[\s\-\.]/g, '')

    const matchedCustomer = await findCustomerByPhone(tenantId, normalizedPhone)

    contextMessages.push({
      role: 'user',
      content: matchedCustomer
        ? `Khách đã để lại SĐT: ${normalizedPhone} và có hồ sơ khách hàng trong hệ thống.`
        : `Khách đã để lại SĐT: ${normalizedPhone}.`,
    })

    if (matchedCustomer) {
      overrideReply =
        'Đã tìm thấy Zalo của bạn. Vui lòng qua Zalo để tiếp tục đặt lịch và nhận thông báo nhé! 🎉'
    }

    detectedPhone = normalizedPhone
  }

  // 7. Call OpenRouter
  const model = config.ai_model ?? 'openai/gpt-4o-mini'
  const defaultReply = await chatCompletion({
    model,
    messages: contextMessages,
  })
  const reply = overrideReply ?? defaultReply

  // 8. Save user message
  await db.execute({
    sql: `INSERT INTO ChatMessage (id, tenant_id, session_id, customer_id, sender, content, channel) VALUES (?, ?, ?, ?, 'customer', ?, ?)`,
    args: [
      randomUUID(),
      tenantId,
      sessionId,
      customerId ?? null,
      userMessage,
      channel,
    ],
  })

  // 9. Save bot reply
  await db.execute({
    sql: `INSERT INTO ChatMessage (id, tenant_id, session_id, customer_id, sender, content, channel) VALUES (?, ?, ?, ?, 'bot', ?, ?)`,
    args: [
      randomUUID(),
      tenantId,
      sessionId,
      customerId ?? null,
      reply,
      channel,
    ],
  })

  // 10. Update session last_message_at
  await db.execute({
    sql: `UPDATE ChatSession SET last_message_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [sessionId],
  })

  // 10.1 Persist detected phone to session metadata
  if (detectedPhone) {
    const sessionMetaResult = await db.execute({
      sql: `SELECT metadata FROM ChatSession WHERE id = ?`,
      args: [sessionId],
    })
    const sessionMetaRow = sessionMetaResult.rows[0] as unknown as { metadata: string | null } | undefined
    const parsedMeta = sessionMetaRow?.metadata ? JSON.parse(sessionMetaRow.metadata) : {}

    await db.execute({
      sql: `UPDATE ChatSession SET metadata = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [JSON.stringify({ ...parsedMeta, customer_phone: detectedPhone }), sessionId],
    })
  }

  // 11. Intent detection
  const intent = detectIntent(userMessage)
  let shouldHandoffToStaff = false
  let finalReply = reply

  if (intent === 'handoff') {
    shouldHandoffToStaff = true
    await db.execute({
      sql: `UPDATE ChatSession SET status = 'active', updated_at = datetime('now') WHERE id = ?`,
      args: [sessionId],
    })
    finalReply =
      'Đang chuyển bạn đến nhân viên. Vui lòng đợi trong giây lát.'
  } else if (intent === 'booking') {
    if (channel === 'zalo') {
      finalReply =
        reply +
        '\n\nĐể nhận thông báo xác nhận đặt lịch qua Zalo, vui lòng nhắn tin trực tiếp cho chúng tôi trên Zalo.'
    }
  }

  return { reply: finalReply, shouldHandoffToStaff }
}
