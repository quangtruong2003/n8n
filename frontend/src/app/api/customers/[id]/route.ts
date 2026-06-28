import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/customers/{id} — Customer detail + notes
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const customerId = req.nextUrl.pathname.split('/').at(-1)!

    const result = await db.execute({
      sql: `SELECT id, tenant_id, name, phone, email, gender, date_of_birth, address, notes, tags, metadata, active, created_at, updated_at
            FROM Customer
            WHERE id = ? AND tenant_id = ?`,
      args: [customerId, user.tenantId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      )
    }

    // Fetch notes
    const notesResult = await db.execute({
      sql: `SELECT cn.id, cn.content, cn.created_at, u.username as created_by
            FROM CustomerNote cn
            JOIN User u ON u.id = cn.user_id
            WHERE cn.customer_id = ?
            ORDER BY cn.created_at DESC`,
      args: [customerId],
    })

    const customer = result.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        customer_notes: notesResult.rows,
      },
    })
  } catch (err) {
    console.error('Get customer error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// PUT /api/customers/{id} — Update customer
export const PUT = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const customerId = req.nextUrl.pathname.split('/').at(-1)!

    // Verify customer exists and belongs to tenant
    const existing = await db.execute({
      sql: 'SELECT * FROM Customer WHERE id = ? AND tenant_id = ?',
      args: [customerId, user.tenantId],
    })

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const allowedFields = ['name', 'phone', 'email', 'gender', 'date_of_birth', 'address', 'notes', 'tags', 'metadata']
    const updates: string[] = []
    const args: (string | number)[] = []

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'tags' || field === 'metadata') {
          args.push(typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field]))
        } else {
          args.push(body[field])
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có trường nào để cập nhật' },
        { status: 400 }
      )
    }

    updates.push("updated_at = datetime('now')")
    args.push(customerId)

    await db.execute({
      sql: `UPDATE Customer SET ${updates.join(', ')} WHERE id = ?`,
      args,
    })

    // Audit log
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
            VALUES (?, ?, ?, 'update', 'customer', ?, ?, ?, datetime('now'))`,
      args: [
        randomUUID(),
        user.tenantId,
        user.id,
        customerId,
        JSON.stringify(existing.rows[0]),
        JSON.stringify(body),
      ],
    })

    const updated = await db.execute({
      sql: 'SELECT * FROM Customer WHERE id = ?',
      args: [customerId],
    })

    return NextResponse.json({
      success: true,
      data: updated.rows[0],
    })
  } catch (err) {
    console.error('Update customer error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// DELETE /api/customers/{id} — Soft delete customer
export const DELETE = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const customerId = req.nextUrl.pathname.split('/').at(-1)!

    // Verify customer exists and belongs to tenant
    const existing = await db.execute({
      sql: 'SELECT * FROM Customer WHERE id = ? AND tenant_id = ?',
      args: [customerId, user.tenantId],
    })

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      )
    }

    if (existing.rows[0].active === 0) {
      return NextResponse.json(
        { success: false, error: 'Khách hàng đã bị vô hiệu hóa' },
        { status: 400 }
      )
    }

    // Soft delete
    await db.execute({
      sql: "UPDATE Customer SET active = 0, updated_at = datetime('now') WHERE id = ?",
      args: [customerId],
    })

    // Audit log
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, created_at)
            VALUES (?, ?, ?, 'delete', 'customer', ?, ?, datetime('now'))`,
      args: [
        randomUUID(),
        user.tenantId,
        user.id,
        customerId,
        JSON.stringify(existing.rows[0]),
      ],
    })

    return NextResponse.json({
      success: true,
      message: 'Đã vô hiệu hóa khách hàng',
    })
  } catch (err) {
    console.error('Delete customer error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
