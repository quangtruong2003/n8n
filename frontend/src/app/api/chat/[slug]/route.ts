import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '../../../../lib/db'
import { processMessage } from '../../../../lib/chat/chat-service'

// ─── In-memory rate limiter (single-instance) ──────────────────
// ponytail: uses Map; expires cleaned lazily. For multi-instance, swap to Redis.

interface RateBucket {
  count: number
  resetAt: number
}

const ipBuckets = new Map<string, RateBucket>()
const sessionBuckets = new Map<string, RateBucket>()

const IP_LIMIT = 30 // requests per minute per IP
const SESSION_LIMIT = 20 // requests per minute per session
const SESSION_HOUR_LIMIT = 100 // messages per session per hour
const WINDOW_MS = 60_000
const HOUR_MS = 3_600_000

// Lazy cleanup every 5 min
const CLEANUP_INTERVAL = 300_000
let lastCleanup = Date.now()

function cleanupBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, bucket] of ipBuckets) {
    if (bucket.resetAt <= now) ipBuckets.delete(key)
  }
  for (const [key, bucket] of sessionBuckets) {
    if (bucket.resetAt <= now) sessionBuckets.delete(key)
  }
}

function checkRateLimit(key: string, limit: number, windowMs: number, buckets: Map<string, RateBucket>): boolean {
  const now = Date.now()
  cleanupBuckets(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false // not exceeded
  }
  bucket.count++
  return bucket.count > limit // true = exceeded
}

// ─── POST /api/chat/{slug} ─────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // 1. Parse body
    const body = await request.json()
    const { message, session_id } = body as {
      message?: string
      session_id?: string
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tin nhắn' },
        { status: 400 },
      )
    }

    const trimmedMessage = message.trim()

    // 2. Rate limit by IP
    if (checkRateLimit(`ip:${ip}`, IP_LIMIT, WINDOW_MS, ipBuckets)) {
      return NextResponse.json(
        { error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng chờ chút.' },
        { status: 429 },
      )
    }

    // 3. Find tenant by slug
    const tenantResult = await db.execute({
      sql: 'SELECT id, active FROM Tenant WHERE slug = ?',
      args: [slug],
    })

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy spa' }, { status: 404 })
    }

    const tenant = tenantResult.rows[0]
    const tenantId = tenant.id as string

    if (tenant.active === 0) {
      return NextResponse.json(
        { error: 'Spa hiện không hoạt động' },
        { status: 403 },
      )
    }

    // 4. Find or create ChatSession
    let sessionId: string
    let existingCustomerId: string | null = null

    if (session_id) {
      // Verify existing session belongs to this tenant
      const existing = await db.execute({
        sql: 'SELECT id, customer_id FROM ChatSession WHERE id = ? AND tenant_id = ?',
        args: [session_id, tenantId],
      })

      if (existing.rows.length > 0) {
        sessionId = existing.rows[0].id as string
        existingCustomerId = existing.rows[0].customer_id as string | null
      } else {
        // Session not found or wrong tenant — create new
        sessionId = randomUUID()
      }

      // Rate limit by session (per-minute)
      if (checkRateLimit(`sess:${sessionId}`, SESSION_LIMIT, WINDOW_MS, sessionBuckets)) {
        return NextResponse.json(
          { error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng chờ chút.' },
          { status: 429 },
        )
      }

      // Abuse check: > 100 messages/session in 1 hour
      const msgCount = await db.execute({
        sql: `SELECT COUNT(*) as cnt FROM ChatMessage WHERE session_id = ? AND created_at > datetime('now', '-1 hour')`,
        args: [sessionId],
      })
      if (Number(msgCount.rows[0].cnt) > SESSION_HOUR_LIMIT) {
        return NextResponse.json(
          { error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng chờ chút.' },
          { status: 429 },
        )
      }
    } else {
      sessionId = randomUUID()
      // No session_id yet, no session-based rate limit to check
    }

    // 5. Find or create anonymous Customer for web channel
    let customerId = existingCustomerId
    if (!customerId) {
      const existingCustomer = await db.execute({
        sql: `SELECT id FROM Customer WHERE tenant_id = ? AND phone = ? LIMIT 1`,
        args: [tenantId, `web-anonymous-${sessionId}`],
      })

      if (existingCustomer.rows.length > 0) {
        customerId = existingCustomer.rows[0].id as string
      } else {
        customerId = randomUUID()
        await db.execute({
          sql: `INSERT INTO Customer (id, tenant_id, name, phone, metadata) VALUES (?, ?, 'Khách vãng lai', ?, '{}')`,
          args: [customerId, tenantId, `web-anonymous-${sessionId}`],
        })
      }
    }

    // 6. Create ChatSession if new
    if (!session_id || !(await db.execute({ sql: 'SELECT id FROM ChatSession WHERE id = ?', args: [sessionId] })).rows.length) {
      await db.execute({
        sql: `INSERT INTO ChatSession (id, tenant_id, customer_id, channel, status, last_message_at) VALUES (?, ?, ?, 'web', 'bot_handling', datetime('now'))`,
        args: [sessionId, tenantId, customerId],
      })
    }

    // 7. Call processMessage
    const result = await processMessage({
      tenantId,
      sessionId,
      customerId: customerId ?? undefined,
      channel: 'web',
      userMessage: trimmedMessage,
    })

    // 8. Get bot name from config
    const botConfig = await db.execute({
      sql: 'SELECT bot_name FROM BotConfig WHERE tenant_id = ?',
      args: [tenantId],
    })
    const botName = (botConfig.rows[0]?.bot_name as string) || 'Trợ lý ảo'

    return NextResponse.json({
      reply: result.reply,
      session_id: sessionId,
      bot_name: botName,
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
