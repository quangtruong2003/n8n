import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

// GET /api/customers/{id}/notes — List notes for customer
export const GET = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const customerId = req.nextUrl.pathname.split('/').at(-2)!

    // Verify customer exists and belongs to tenant
    const customer = await db.execute({
      sql: 'SELECT id FROM Customer WHERE id = ? AND tenant_id = ?',
      args: [customerId, user.tenantId],
    })

    if (customer.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      )
    }

    const url = req.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as total FROM CustomerNote WHERE customer_id = ?',
      args: [customerId],
    })
    const total = (countResult.rows[0].total as number) || 0

    const result = await db.execute({
      sql: `SELECT cn.id, cn.content, cn.created_at, u.username as created_by
            FROM CustomerNote cn
            JOIN User u ON u.id = cn.user_id
            WHERE cn.customer_id = ?
            ORDER BY cn.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [customerId, limit, offset],
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (err) {
    console.error('List customer notes error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})

// POST /api/customers/{id}/notes — Create note
export const POST = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const customerId = req.nextUrl.pathname.split('/').at(-2)!

    // Verify customer exists and belongs to tenant
    const customer = await db.execute({
      sql: 'SELECT id FROM Customer WHERE id = ? AND tenant_id = ?',
      args: [customerId, user.tenantId],
    })

    if (customer.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nội dung ghi chú là bắt buộc' },
        { status: 400 }
      )
    }

    const noteId = randomUUID()

    await db.execute({
      sql: `INSERT INTO CustomerNote (id, customer_id, user_id, content, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [noteId, customerId, user.id, content.trim()],
    })

    const created = await db.execute({
      sql: `SELECT cn.id, cn.content, cn.created_at, u.username as created_by
            FROM CustomerNote cn
            JOIN User u ON u.id = cn.user_id
            WHERE cn.id = ?`,
      args: [noteId],
    })

    return NextResponse.json({
      success: true,
      data: created.rows[0],
    }, { status: 201 })
  } catch (err) {
    console.error('Create customer note error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
