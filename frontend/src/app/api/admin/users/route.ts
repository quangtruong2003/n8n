import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/admin/users — List all users (super_admin only)
export const GET = withAuth(
  async (req) => {
    try {
      const url = req.nextUrl
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
      const offset = (page - 1) * limit

      const tenantId = url.searchParams.get('tenant_id')
      const role = url.searchParams.get('role')

      // Build WHERE clause
      const conditions: string[] = []
      const args: (string | number)[] = []

      if (tenantId) {
        conditions.push('u.tenant_id = ?')
        args.push(tenantId)
      }

      if (role) {
        conditions.push('u.role = ?')
        args.push(role)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Count
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as total FROM User u ${where}`,
        args,
      })
      const total = (countResult.rows[0].total as number) || 0

      // Fetch users (exclude password_hash)
      const result = await db.execute({
        sql: `SELECT u.id, u.username, u.role, u.tenant_id, u.full_name, u.phone, u.email, u.active, u.created_at, u.updated_at,
                     t.name as tenant_name, t.slug as tenant_slug
              FROM User u
              LEFT JOIN Tenant t ON t.id = u.tenant_id
              ${where}
              ORDER BY u.created_at DESC
              LIMIT ? OFFSET ?`,
        args: [...args, limit, offset],
      })

      return NextResponse.json({
        success: true,
        data: result.rows,
        meta: { total, page, limit },
      })
    } catch (err) {
      console.error('List users error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)
