import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../../lib/db'

// ─── GET /api/chat/{slug}/sessions/{sessionId} ─────────────
// Public endpoint — no auth required

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; sessionId: string }> },
) {
  try {
    const { slug, sessionId } = await params

    // 1. Find tenant by slug
    const tenantResult = await db.execute({
      sql: 'SELECT id FROM Tenant WHERE slug = ?',
      args: [slug],
    })

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant không tồn tại' }, { status: 404 })
    }

    const tenantId = tenantResult.rows[0].id as string

    // 2. Verify session belongs to this tenant
    const sessionResult = await db.execute({
      sql: 'SELECT id FROM ChatSession WHERE id = ? AND tenant_id = ?',
      args: [sessionId, tenantId],
    })

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Session không tồn tại' }, { status: 404 })
    }

    // 3. Get all messages for session, ORDER BY created_at ASC
    const messagesResult = await db.execute({
      sql: 'SELECT * FROM ChatMessage WHERE session_id = ? ORDER BY created_at ASC',
      args: [sessionId],
    })

    const messages = messagesResult.rows

    // 4. Collect unique sender_ids to resolve sender names
    const senderIds = [
      ...new Set(
        messages
          .map((m) => m.sender_id as string | null)
          .filter(Boolean),
      ),
    ]

    const senderMap = new Map<string, string>()
    if (senderIds.length > 0) {
      const placeholders = senderIds.map(() => '?').join(', ')
      const customersResult = await db.execute({
        sql: `SELECT id, name FROM Customer WHERE id IN (${placeholders})`,
        args: senderIds,
      })
      for (const row of customersResult.rows) {
        senderMap.set(row.id as string, row.name as string)
      }
    }

    // 5. Return messages with sender info
    const data = messages.map((m) => ({
      id: m.id,
      session_id: m.session_id,
      sender_type: m.sender_type,
      sender_id: m.sender_id,
      sender_name: m.sender_id ? senderMap.get(m.sender_id as string) ?? null : null,
      content: m.content,
      metadata: m.metadata,
      created_at: m.created_at,
    }))

    return NextResponse.json({ messages: data })
  } catch (err) {
    console.error('Get session messages error:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
