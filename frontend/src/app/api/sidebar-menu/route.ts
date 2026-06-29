import { NextResponse } from 'next/server'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

export const GET = withAuth(async (_req, { user }) => {
  try {
    // Owner sees all items. Staff sees only items matching their role permissions.
    if (user.role === 'super_admin' || user.role === 'owner') {
      const result = await db.execute({
        sql: 'SELECT id, label, href, icon, sort_order, resource, role FROM SidebarMenu WHERE active = 1 ORDER BY sort_order ASC',
        args: [],
      })
      return NextResponse.json({ success: true, data: result.rows })
    }

    // Staff: get permissions for this user's role
    const permResult = await db.execute({
      sql: `SELECT p.resource FROM Permission p
            JOIN Role r ON r.id = p.role_id
            WHERE r.name = ? AND r.tenant_id = ? AND p.can_view = 1`,
      args: [user.role, user.tenantId],
    })
    const allowedResources = permResult.rows.map(r => r.resource as string)

    // Get sidebar items where role = 'all' or role matches user role
    const menuResult = await db.execute({
      sql: 'SELECT id, label, href, icon, sort_order, resource, role FROM SidebarMenu WHERE active = 1 ORDER BY sort_order ASC',
      args: [],
    })

    // Filter: role=all always shown. Others: check resource permission.
    const filtered = menuResult.rows.filter((row) => {
      if (row.role === 'all') return true
      if (row.resource === null) return true // items without resource check
      return allowedResources.includes(row.resource as string)
    })

    return NextResponse.json({ success: true, data: filtered })
  } catch (err: any) {
    console.error('Sidebar menu error:', err?.message)
    return NextResponse.json({ success: false, error: err?.message || 'Lỗi server' }, { status: 500 })
  }
})
