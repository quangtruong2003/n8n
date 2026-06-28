import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

// PUT /api/staff/{id}/branches — Assign branches to staff
export const PUT = withAuth(
  async (req, { user }) => {
    try {
      if (!user.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tenant' },
          { status: 404 }
        )
      }

      // Extract staff id from path: /api/staff/[id]/branches
      const segments = req.nextUrl.pathname.split('/')
      const staffId = segments[segments.length - 2]

      // Verify staff exists and belongs to tenant
      const existing = await db.execute({
        sql: "SELECT id, username, full_name FROM User WHERE id = ? AND tenant_id = ? AND role = 'staff'",
        args: [staffId, user.tenantId],
      })

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy nhân viên' },
          { status: 404 }
        )
      }

      const body = await req.json()
      const { branch_ids } = body

      if (!Array.isArray(branch_ids)) {
        return NextResponse.json(
          { success: false, error: 'branch_ids phải là mảng' },
          { status: 400 }
        )
      }

      // Get old branch assignments for audit
      const oldAssignments = await db.execute({
        sql: 'SELECT branch_id FROM UserBranch WHERE user_id = ?',
        args: [staffId],
      })

      // Delete old assignments
      await db.execute({
        sql: 'DELETE FROM UserBranch WHERE user_id = ?',
        args: [staffId],
      })

      // Insert new assignments
      if (branch_ids.length > 0) {
        for (const branchId of branch_ids) {
          await db.execute({
            sql: 'INSERT INTO UserBranch (user_id, branch_id) VALUES (?, ?)',
            args: [staffId, branchId],
          })
        }
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
              VALUES (?, ?, ?, 'update', 'user_branch', ?, ?, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.tenantId,
          user.id,
          staffId,
          JSON.stringify(oldAssignments.rows.map((r) => r.branch_id)),
          JSON.stringify(branch_ids),
        ],
      })

      return NextResponse.json({
        success: true,
        data: { user_id: staffId, branch_ids },
      })
    } catch (err) {
      console.error('Assign branches error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['owner'] }
)
