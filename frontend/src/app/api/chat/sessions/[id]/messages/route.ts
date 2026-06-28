import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthUser } from '../../../../../../lib/auth/middleware'
import { db } from '../../../../../../lib/db'

// GET /api/chat/sessions/{id}/messages — Auth required
export const GET = withAuth(
  async (req: NextRequest, { user }: { user: AuthUser }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Tenant not found' },
          { status: 404 },
        )
      }

      // 1. Extract session id from route params
      const url = req.nextUrl
      const segments = url.pathname.split('/')
      // .../chat/sessions/{id}/messages → id is 4th segment from the end
      const sessionId = segments[segments.length - 2]

      // 2. Parse pagination
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
      const offset = (page - 1) * limit

      // 3. Verify session belongs to tenant
      const sessionResult = await db.execute({
        sql: 'SELECT id, assigned_staff_id FROM ChatSession WHERE id = ? AND tenant_id = ?',
        args: [sessionId, user.tenantId],
      })

      if (sessionResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 },
        )
      }

      const session = sessionResult.rows[0]
      const assignedStaffId = session.assigned_staff_id as string | null

      // 4. Count total messages
      const countResult = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM ChatMessage WHERE session_id = ?',
        args: [sessionId],
      })
      const total = (countResult.rows[0]?.total as number) || 0

      // 5. Fetch messages ordered by created_at ASC with customer name
      const messagesResult = await db.execute({
        sql: `
          SELECT
            cm.id,
            cm.session_id,
            cm.tenant_id,
            cm.customer_id,
            cm.sender,
            cm.content,
            cm.channel,
            cm.metadata,
            cm.created_at,
            c.name as customer_name
          FROM ChatMessage cm
          LEFT JOIN Customer c ON c.id = cm.customer_id
          WHERE cm.session_id = ?
          ORDER BY cm.created_at ASC
          LIMIT ? OFFSET ?
        `,
        args: [sessionId, limit, offset],
      })

      // 6. Resolve staff name if session has an assigned staff member
      let staffName: string | null = null
      if (assignedStaffId) {
        const staffResult = await db.execute({
          sql: 'SELECT username FROM User WHERE id = ?',
          args: [assignedStaffId],
        })
        if (staffResult.rows.length > 0) {
          staffName = staffResult.rows[0].username as string
        }
      }

      // 7. Shape response with sender_name
      const messages = messagesResult.rows.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        tenant_id: row.tenant_id,
        customer_id: row.customer_id,
        sender: row.sender,
        sender_name:
          row.sender === 'customer'
            ? (row.customer_name as string | null)
            : row.sender === 'staff'
              ? staffName
              : 'Bot',
        content: row.content,
        channel: row.channel,
        metadata: row.metadata,
        created_at: row.created_at,
      }))

      return NextResponse.json({
        success: true,
        data: messages,
        meta: { total, page, limit },
      })
    } catch (err) {
      console.error('Get session messages error:', err)
      return NextResponse.json(
        { success: false, error: 'Server error' },
        { status: 500 },
      )
    }
  },
)
