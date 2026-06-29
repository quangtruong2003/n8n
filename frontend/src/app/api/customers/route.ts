import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

// GET /api/customers — List customers with filters
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const url = req.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit
    const search = url.searchParams.get('search')?.trim() || ''
    const tags = url.searchParams.get('tags')?.trim() || ''

    const conditions: string[] = ['tenant_id = ?', 'active = 1']
    const args: (string | number)[] = [user.tenantId]

    if (search) {
      conditions.push('(full_name LIKE ? OR phone LIKE ?)')
      const like = `%${search}%`
      args.push(like, like)
    }

    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
      for (const tag of tagList) {
        conditions.push("tags LIKE ?")
        args.push(`%"${tag}"%`)
      }
    }

    const where = conditions.join(' AND ')

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM Customer WHERE ${where}`,
      args,
    })
    const total = (countResult.rows[0].total as number) || 0

    const result = await db.execute({
      sql: `SELECT id, tenant_id, full_name, phone, email, gender, date_of_birth, address, notes, tags, metadata, active, total_spent, total_bookings, last_visit_at, created_at, updated_at
            FROM Customer
            WHERE ${where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (err: any) {
    console.error('List customers error:', err?.message, err?.stack)
    return NextResponse.json(
      { success: false, error: 'Lỗi server: ' + (err?.message || 'unknown') },
      { status: 500 }
    )
  }
})

// POST /api/customers — Create customer
export const POST = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { name, phone, email, gender, date_of_birth, address, notes, tags, metadata } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tên khách hàng là bắt buộc' },
        { status: 400 }
      )
    }

    const customerId = randomUUID()
    const tagsJson = tags ? JSON.stringify(tags) : '[]'
    const metadataJson = metadata ? JSON.stringify(metadata) : '{}'

    await db.execute({
      sql: `INSERT INTO Customer (id, tenant_id, full_name, phone, email, gender, date_of_birth, address, notes, tags, metadata, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      args: [
        customerId,
        user.tenantId,
        name.trim(),
        phone || null,
        email || null,
        gender || null,
        date_of_birth || null,
        address || null,
        notes || null,
        tagsJson,
        metadataJson,
      ],
    })

    // Audit log
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
            VALUES (?, ?, ?, 'create', 'customer', ?, ?, datetime('now'))`,
      args: [
        randomUUID(),
        user.tenantId,
        user.id,
        customerId,
        JSON.stringify({ name: name.trim(), phone, email }),
      ],
    })

    const created = await db.execute({
      sql: 'SELECT * FROM Customer WHERE id = ?',
      args: [customerId],
    })

    return NextResponse.json({
      success: true,
      data: created.rows[0],
    }, { status: 201 })
  } catch (err) {
    console.error('Create customer error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
