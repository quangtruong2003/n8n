import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth, AuthUser } from '../../../../../../lib/auth/middleware'
import { db } from '../../../../../../lib/db'

// PATCH /api/chat/sessions/{id}/assign — Assign staff or resolve session
export const PATCH = withAuth(
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
      // /api/chat/sessions/[id]/assign -> segments[4] = id
      const sessionId = segments[4]

      // 2. Parse body
      const body = await req.json()
      const { staff_id, action } = body as {
        staff_id?: string
        action?: 'assign' | 'resolve'
      }

      if (!action || !['assign', 'resolve'].includes(action)) {
        return NextResponse.json(
          { success: false, error: 'action must be "assign" or "resolve"' },
          { status: 400 },
        )
      }

      if (action === 'assign' && !staff_id) {
        return NextResponse.json(
          { success: false, error: 'staff_id is required when action is "assign"' },
          { status: 400 },
        )
      }

      // 3. Verify session belongs to user's tenant
      const sessionResult = await db.execute({
        sql: 'SELECT id, status, assigned_staff_id FROM ChatSession WHERE id = ? AND tenant_id = ?',
        args: [sessionId, user.tenantId],
      })

      if (sessionResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 },
        )
      }

      const session = sessionResult.rows[0]
      const now = new Date().toISOString()

      // 4. Apply action
      if (action === 'assign') {
        await db.execute({
          sql: `UPDATE ChatSession
                SET assigned_staff_id = ?, status = 'staff_handling', updated_at = ?
                WHERE id = ?`,
          args: [staff_id as string, now, sessionId],
        })
      } else {
        await db.execute({
          sql: `UPDATE ChatSession
                SET status = 'resolved', updated_at = ?
                WHERE id = ?`,
          args: [now, sessionId],
        })
      }

      // 5. Audit log
      await db.execute({
        sql: `
          INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
          VALUES (?, ?, ?, ?, 'ChatSession', ?, ?, ?, ?)
        `,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          action === 'assign' ? 'assign' : 'resolve',
          sessionId,
          JSON.stringify({
            status: session.status,
            assigned_staff_id: session.assigned_staff_id,
          }),
          JSON.stringify({
            status: action === 'assign' ? 'staff_handling' : 'resolved',
            assigned_staff_id: action === 'assign' ? staff_id : session.assigned_staff_id,
          }),
          now,
        ],
      })

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('Session assign/resolve error:', err)
      return NextResponse.json(
        { success: false, error: 'Server error' },
        { status: 500 },
      )
    }
  },
  { requiredPermission: { resource: 'chat', action: 'edit' } },
)
