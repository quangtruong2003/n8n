import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth, AuthUser } from '../../../../../../lib/auth/middleware'
import { db } from '../../../../../../lib/db'
import { sendZaloMessage } from '../../../../../../lib/chat/zalo'

// POST /api/chat/sessions/{id}/reply — Staff reply to a chat session
export const POST = withAuth(
  async (req: NextRequest, { user }: { user: AuthUser }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Tenant not found' },
          { status: 404 },
        )
      }

      // 1. Extract sessionId from URL
      const segments = req.nextUrl.pathname.split('/')
      const sessionId = segments[segments.length - 2]

      // 2. Parse body
      const body = await req.json()
      const content = body?.content?.trim()

      if (!content) {
        return NextResponse.json(
          { success: false, error: 'content is required' },
          { status: 400 },
        )
      }

      // 3. Verify session belongs to tenant
      const sessionResult = await db.execute({
        sql: 'SELECT id, metadata FROM ChatSession WHERE id = ? AND tenant_id = ?',
        args: [sessionId, user.tenantId],
      })

      if (sessionResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 },
        )
      }

      const session = sessionResult.rows[0]

      // 4. Insert staff message
      const messageId = randomUUID()
      const now = new Date().toISOString()

      await db.execute({
        sql: `INSERT INTO ChatMessage (id, session_id, tenant_id, sender, sender_id, content, channel, created_at)
              VALUES (?, ?, ?, 'staff', ?, ?, 'web', ?)`,
        args: [messageId, sessionId, user.tenantId, user.id, content, now],
      })

      // 5. Update session status
      await db.execute({
        sql: `UPDATE ChatSession
              SET status = 'staff_handling', assigned_staff_id = ?, updated_at = ?
              WHERE id = ?`,
        args: [user.id, now, sessionId],
      })

      // 6. Forward to Zalo if session has zalo_thread_id
      const metadata = session.metadata
        ? typeof session.metadata === 'string'
          ? JSON.parse(session.metadata)
          : session.metadata
        : null

      const zaloThreadId = metadata?.zalo_thread_id
      if (zaloThreadId) {
        await sendZaloMessage(user.tenantId, String(zaloThreadId), content)
      }

      // 7. Return message
      return NextResponse.json({
        success: true,
        data: {
          id: messageId,
          session_id: sessionId,
          sender: 'staff',
          sender_id: user.id,
          content,
          created_at: now,
        },
      })
    } catch (err) {
      console.error('Staff reply error:', err)
      return NextResponse.json(
        { success: false, error: 'Server error' },
        { status: 500 },
      )
    }
  },
  { requiredPermission: { resource: 'chat', action: 'create' } },
)
