import { db } from '../db'

// ─── PII Masking ────────────────────────────────────────────
/** Mask phone: 0912345678 → 0912***678 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***'
  return phone.slice(0, 4) + '***' + phone.slice(-3)
}

// ─── Types ──────────────────────────────────────────────────
interface ChatMessage {
  role: 'system'
  content: string
}

interface SpaRow {
  name: string
  phone: string | null
  open_time: string | null
  close_time: string | null
}

interface ConfigRow {
  bot_name: string | null
  bot_greeting: string | null
  ai_system_prompt: string | null
}

interface ServiceRow {
  name: string
  price: number
  duration: number | null
  description: string | null
}

interface BranchRow {
  name: string
  address: string | null
}

// ─── Context Builder ────────────────────────────────────────
export async function buildAIContext(
  tenantId: string,
  previousContext?: string,
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = []

  // 1. BotConfig — system prompt + bot name
  const configResult = await db.execute({
    sql: `SELECT bot_name, bot_greeting, ai_system_prompt FROM SpaConfig WHERE spa_id = ?`,
    args: [tenantId],
  })
  const config = configResult.rows[0] as unknown as ConfigRow | undefined

  const systemPrompt =
    config?.ai_system_prompt ??
    config?.bot_greeting ??
    'Bạn là trợ lý AI của spa. Trả lời ngắn gọn, lịch sự, bằng tiếng Việt.'
  messages.push({ role: 'system', content: systemPrompt })

  if (config?.bot_name) {
    messages.push({
      role: 'system',
      content: `Tên bạn là: ${config.bot_name}`,
    })
  }

  // 2. Active services / products + prices
  const svcResult = await db.execute({
    sql: `SELECT name, price, duration, description FROM Service WHERE spa_id = ? AND active = 1`,
    args: [tenantId],
  })
  const services = svcResult.rows as unknown as ServiceRow[]

  if (services.length > 0) {
    const serviceList = services
      .map((s) => {
        const price = s.price.toLocaleString('vi-VN')
        const dur = s.duration ? ` (${s.duration} phút)` : ''
        const desc = s.description ? ` — ${s.description}` : ''
        return `- ${s.name}: ${price}đ${dur}${desc}`
      })
      .join('\n')

    messages.push({
      role: 'system',
      content: `Danh sách dịch vụ hiện có:\n${serviceList}`,
    })
  }

  // 3. Tenant info — name, hours, phone
  const spaResult = await db.execute({
    sql: `SELECT name, phone, open_time, close_time FROM Spa WHERE id = ?`,
    args: [tenantId],
  })
  const spa = spaResult.rows[0] as unknown as SpaRow | undefined

  if (spa) {
    const hours =
      spa.open_time && spa.close_time
        ? `${spa.open_time} - ${spa.close_time}`
        : 'Chưa cập nhật'
    const phone = spa.phone ? `Liên hệ: ${maskPhone(spa.phone)}` : ''

    messages.push({
      role: 'system',
      content: [
        `Tên spa: ${spa.name}`,
        `Giờ mở cửa: ${hours}`,
        phone,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  // 4. Branch list + addresses
  const branchResult = await db.execute({
    sql: `SELECT name, address FROM Branch WHERE spa_id = ?`,
    args: [tenantId],
  })
  const branches = branchResult.rows as unknown as BranchRow[]

  if (branches.length > 0) {
    const branchList = branches
      .map((b) => `- ${b.name}${b.address ? `: ${b.address}` : ''}`)
      .join('\n')

    messages.push({
      role: 'system',
      content: `Chi nhánh:\n${branchList}`,
    })
  }

  // 5. Cross-channel context (e.g., web → Zalo)
  if (previousContext) {
    messages.push({
      role: 'system',
      content: `Thông tin từ cuộc trò chuyện trước (kênh khác): ${previousContext}`,
    })
  }

  return messages
}
