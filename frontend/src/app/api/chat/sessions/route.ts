import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthUser } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

const ALLOWED_STATUSES = ['active', 'bot_handling', 'staff_handling', 'resolved'] as const
type SessionStatus = (typeof ALLOWED_STATUSES)[number]

// GET /api/chat/sessions — List chat sessions with customer info + last message preview
export const GET = withAuth(async (req: NextRequest, { user }: { user: AuthUser }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    // 1. Parse query params
    const url = req.nextUrl
    const statusParam = url.searchParams.get('status')
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    // 2. Validate status
    let statusFilter: SessionStatus | null = null
    if (statusParam) {
      if (!ALLOWED_STATUSES.includes(statusParam as SessionStatus)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status filter' },
          { status: 400 }
        )
      }
      statusFilter = statusParam as SessionStatus
    }

    // 3. Check PII permission: owners/super_admins see full PII, staff check chat.view
    const canViewPII = await checkPIIPermission(user)

    // 4. Build query
    const conditions: string[] = ['cs.tenant_id = ?']
    const args: (string | number)[] = [user.tenantId]

    if (statusFilter) {
      conditions.push('cs.status = ?')
      args.push(statusFilter)
    }

    const where = conditions.join(' AND ')

    // 5. Count total
    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM ChatSession cs WHERE ${where}`,
      args,
    })
    const total = (countResult.rows[0]?.total as number) || 0

    // 6. Fetch sessions with customer info + last message preview
    const result = await db.execute({
      sql: `
        SELECT
          cs.id,
          cs.tenant_id,
          cs.customer_id,
          cs.channel,
          cs.status,
          cs.assigned_staff_id,
          cs.last_message_at,
          cs.metadata as session_metadata,
          cs.created_at,
          cs.updated_at,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          lm.content as last_message_content,
          lm.sender as last_message_sender,
          lm.created_at as last_message_created_at
        FROM ChatSession cs
        LEFT JOIN Customer c ON c.id = cs.customer_id
        LEFT JOIN ChatMessage lm ON lm.id = (
          SELECT id FROM ChatMessage
          WHERE session_id = cs.id
          ORDER BY created_at DESC
          LIMIT 1
        )
        WHERE ${where}
        ORDER BY cs.last_message_at DESC NULLS LAST, cs.created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [...args, limit, offset],
    })

    // 7. Shape response with PII protection
    const sessions = result.rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      customer_id: row.customer_id,
      channel: row.channel,
      status: row.status,
      assigned_staff_id: row.assigned_staff_id,
      last_message_at: row.last_message_at,
      session_metadata: row.session_metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer: row.customer_id
        ? {
            name: canViewPII
              ? row.customer_name
              : maskPii(row.customer_name as string),
            phone: canViewPII
              ? row.customer_phone
              : maskPhone(row.customer_phone as string),
            email: row.customer_email,
          }
        : null,
      last_message: row.last_message_content
        ? {
            content: row.last_message_content,
            sender: row.last_message_sender,
            created_at: row.last_message_created_at,
          }
        : null,
    }))

    return NextResponse.json({
      success: true,
      data: sessions,
      meta: { total, page, limit },
    })
  } catch (err) {
    console.error('List chat sessions error:', err)
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    )
  }
})

// --- Helpers ---

async function checkPIIPermission(user: AuthUser): Promise<boolean> {
  if (user.role === 'super_admin' || user.role === 'owner') {
    return true
  }

  const permResult = await db.execute({
    sql: `
      SELECT p.can_view as allowed
      FROM Permission p
      JOIN Role r ON r.id = p.role_id
      WHERE r.name = ? AND r.tenant_id = ? AND p.resource = 'chat'
    `,
    args: [user.role, user.tenantId],
  })

  return permResult.rows.length > 0 && permResult.rows[0].allowed === 1
}

function maskPii(value: string | null): string | null {
  if (!value || value.length <= 2) return value
  const chars = value.split('')
  // Keep first and last char, mask the rest
  for (let i = 1; i < chars.length - 1; i++) {
    chars[i] = '*'
  }
  return chars.join('')
}

function maskPhone(value: string | null): string | null {
  if (!value || value.length <= 2) return value
  const chars = value.split('')
  // Keep last 2 digits, mask the rest
  for (let i = 0; i < chars.length - 2; i++) {
    chars[i] = '*'
  }
  return chars.join('')
}
