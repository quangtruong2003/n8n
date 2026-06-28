import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/tenant/settings — Get tenant settings
export const GET = withAuth(async (_req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const result = await db.execute({
      sql: `SELECT id, name, phone, email, address, logo_url,
                   open_time, close_time, business_type, slug,
                   active, metadata, created_at, updated_at
            FROM Tenant WHERE id = ?`,
      args: [user.tenantId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    })
  } catch (err) {
    console.error('Get tenant settings error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// PUT /api/tenant/settings — Update tenant settings
const ALLOWED_FIELDS = ['name', 'phone', 'email', 'open_time', 'close_time', 'address', 'logo_url']

export const PUT = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const updates: string[] = []
    const args: (string | number)[] = []

    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        args.push(body[field])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có trường nào để cập nhật' },
        { status: 400 }
      )
    }

    updates.push("updated_at = datetime('now')")
    args.push(user.tenantId)

    await db.execute({
      sql: `UPDATE Tenant SET ${updates.join(', ')} WHERE id = ?`,
      args,
    })

    // Audit log
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
            VALUES (?, ?, ?, 'update', 'tenant_settings', ?, ?, datetime('now'))`,
      args: [
        randomUUID(),
        user.tenantId,
        user.id,
        user.tenantId,
        JSON.stringify(body),
      ],
    })

    // Return updated settings
    const updated = await db.execute({
      sql: `SELECT id, name, phone, email, address, logo_url,
                   open_time, close_time, business_type, slug,
                   active, metadata, created_at, updated_at
            FROM Tenant WHERE id = ?`,
      args: [user.tenantId],
    })

    return NextResponse.json({
      success: true,
      data: updated.rows[0],
    })
  } catch (err) {
    console.error('Update tenant settings error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
