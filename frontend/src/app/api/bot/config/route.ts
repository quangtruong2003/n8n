import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

const UPDATE_WHITELIST = [
  'bot_name',
  'greeting',
  'ai_enabled',
  'working_hours_only',
  'web_widget_theme',
] as const

// Map API field names to DB columns
const FIELD_MAP: Record<string, string> = {
  bot_greeting: 'greeting',
  web_widget_enabled: 'channels',
}

function serializeRow(row: Record<string, unknown>) {
  const channels = JSON.parse((row.channels as string) ?? '["web"]')
  const webWidgetEnabled = Array.isArray(channels) && channels.includes('web') ? 1 : 0
  return {
    ai_enabled: row.ai_enabled,
    bot_name: row.bot_name,
    bot_greeting: row.bot_greeting,
    working_hours_only: row.working_hours_only,
    web_widget_enabled: webWidgetEnabled,
    web_widget_theme: row.web_widget_theme,
    zalo_connected: row.zalo_connected,
    zalo_account_name: row.zalo_account_name ?? null,
  }
}

// GET /api/bot/config — read BotConfig, hide sensitive fields
export const GET = withAuth(async (_req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 },
      )
    }

    const result = await db.execute({
      sql: `SELECT bot_name, bot_greeting, ai_enabled, working_hours_only,
                   web_widget_theme, channels,
                   zalo_connected, zalo_account_name
            FROM BotConfig WHERE tenant_id = ?`,
      args: [user.tenantId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cấu hình bot' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: serializeRow(result.rows[0] as Record<string, unknown>),
    })
  } catch (err) {
    console.error('[BotConfig] GET error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server nội bộ' },
      { status: 500 },
    )
  }
}, { requiredRole: ['owner'] })

// PUT /api/bot/config — partial update with whitelist
export const PUT = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 },
      )
    }

    const body = await req.json()
    const setClauses: string[] = []
    const args: (string | number)[] = []
    const changed: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue

      // Accept API field names and map to DB columns
      const dbCol = FIELD_MAP[key] ?? (UPDATE_WHITELIST.includes(key as typeof UPDATE_WHITELIST[number]) ? key : null)
      if (!dbCol) continue

      // Validate web_widget_theme shape
      if (key === 'web_widget_theme') {
        try {
          const parsed = typeof value === 'string' ? JSON.parse(value) : value
          if (parsed && typeof parsed === 'object') {
            const valid: Record<string, unknown> = {}
            if (typeof parsed.primaryColor === 'string') valid.primaryColor = parsed.primaryColor
            if (parsed.position === 'bottom-right' || parsed.position === 'bottom-left') valid.position = parsed.position
            if (typeof parsed.greeting === 'string') valid.greeting = parsed.greeting
            setClauses.push(`${dbCol} = ?`)
            args.push(JSON.stringify(valid))
            changed[key] = valid
            continue
          }
        } catch { /* fall through — skip invalid JSON */ }
        continue
      }

      // Special handling for web_widget_enabled → channels JSON
      if (key === 'web_widget_enabled') {
        const flag = value ? 1 : 0
        const channels = flag === 1 ? '["web"]' : '[]'
        setClauses.push(`${dbCol} = ?`)
        args.push(channels)
        changed[key] = flag
        continue
      }

      setClauses.push(`${dbCol} = ?`)
      args.push(value as string | number)
      changed[key] = value
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có trường nào để cập nhật' },
        { status: 400 },
      )
    }

    setClauses.push("updated_at = datetime('now')")
    args.push(user.tenantId)

    await db.execute({
      sql: `UPDATE BotConfig SET ${setClauses.join(', ')} WHERE tenant_id = ?`,
      args,
    })

    // Audit log
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
            VALUES (?, ?, ?, 'update', 'bot_config', ?, ?, datetime('now'))`,
      args: [
        randomUUID(),
        user.tenantId,
        user.id,
        user.tenantId,
        JSON.stringify(changed),
      ],
    })

    // Return updated config
    const result = await db.execute({
      sql: `SELECT bot_name, bot_greeting, ai_enabled, working_hours_only,
                   web_widget_theme, channels,
                   zalo_connected, zalo_account_name
            FROM BotConfig WHERE tenant_id = ?`,
      args: [user.tenantId],
    })

    return NextResponse.json({
      success: true,
      data: serializeRow(result.rows[0] as Record<string, unknown>),
    })
  } catch (err) {
    console.error('[BotConfig] PUT error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server nội bộ' },
      { status: 500 },
    )
  }
}, { requiredRole: ['owner'] })
