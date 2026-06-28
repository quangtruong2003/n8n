import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

// GET /api/bookings?status=&branch_id=&date=&page=&limit=
export const GET = withAuth(async (req, { user }) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const branchId = searchParams.get('branch_id')
    const date = searchParams.get('date')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    const conditions: string[] = ['b.tenant_id = ?']
    const args: (string | number)[] = [user.tenantId!]

    if (status) {
      conditions.push('b.status = ?')
      args.push(status)
    }
    if (branchId) {
      conditions.push('b.branch_id = ?')
      args.push(branchId)
    }
    if (date) {
      conditions.push("date(b.booking_start) = ?")
      args.push(date)
    }

    const where = conditions.join(' AND ')

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM Booking b WHERE ${where}`,
      args,
    })
    const total = Number(countResult.rows[0].total)

    const result = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name, br.name as branch_name
        FROM Booking b
        LEFT JOIN Customer c ON c.id = b.customer_id
        LEFT JOIN Branch br ON br.id = b.branch_id
        WHERE ${where}
        ORDER BY b.booking_start DESC
        LIMIT ? OFFSET ?
      `,
      args: [...args, limit, offset],
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

// POST /api/bookings
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const { branch_id, customer_id, booking_start, booking_end, note, items } = body as {
      branch_id?: string
      customer_id?: string
      booking_start?: string
      booking_end?: string
      note?: string
      items?: { product_id: string; staff_id?: string; quantity?: number; price: number }[]
    }

    // Validate required fields
    if (!branch_id || !customer_id || !booking_start || !booking_end) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: branch_id, customer_id, booking_start, booking_end' },
        { status: 400 }
      )
    }

    // Validate booking_start < booking_end
    if (new Date(booking_start) >= new Date(booking_end)) {
      return NextResponse.json(
        { success: false, error: 'booking_start must be before booking_end' },
        { status: 400 }
      )
    }

    // Check overlapping bookings on same branch
    const overlap = await db.execute({
      sql: `
        SELECT id FROM Booking
        WHERE branch_id = ?
          AND status NOT IN ('cancelled', 'no_show')
          AND booking_start < ?
          AND booking_end > ?
      `,
      args: [branch_id, booking_end, booking_start],
    })

    if (overlap.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Time slot overlaps with an existing booking' },
        { status: 409 }
      )
    }

    const bookingId = randomUUID()
    const now = new Date().toISOString()

    await db.execute({
      sql: `
        INSERT INTO Booking (id, tenant_id, branch_id, customer_id, status, booking_start, booking_end, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
      `,
      args: [bookingId, user.tenantId!, branch_id, customer_id, booking_start, booking_end, note || null, now, now],
    })

    // Insert booking items
    if (items && items.length > 0) {
      for (const item of items) {
        await db.execute({
          sql: `
            INSERT INTO BookingItem (id, booking_id, product_id, staff_id, quantity, price)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          args: [
            randomUUID(),
            bookingId,
            item.product_id,
            item.staff_id || null,
            item.quantity || 1,
            item.price,
          ],
        })
      }
    }

    // Audit log
    await db.execute({
      sql: `
        INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
        VALUES (?, ?, ?, 'create', 'Booking', ?, ?, ?)
      `,
      args: [randomUUID(), user.tenantId!, user.id, bookingId, JSON.stringify({ branch_id, customer_id, booking_start, booking_end }), now],
    })

    // Fetch and return the created booking
    const created = await db.execute({
      sql: 'SELECT * FROM Booking WHERE id = ?',
      args: [bookingId],
    })

    return NextResponse.json({ success: true, data: created.rows[0] }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
