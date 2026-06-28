import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/bookings/:id — booking detail with items
export const GET = withAuth(async (req, { user }) => {
  try {
    const id = req.nextUrl.pathname.split('/').pop()

    const bookingResult = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name, c.phone as customer_phone,
               br.name as branch_name
        FROM Booking b
        LEFT JOIN Customer c ON c.id = b.customer_id
        LEFT JOIN Branch br ON br.id = b.branch_id
        WHERE b.id = ? AND b.tenant_id = ?
      `,
      args: [id!, user.tenantId!],
    })

    if (bookingResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const itemsResult = await db.execute({
      sql: `
        SELECT bi.*, p.name as product_name, u.full_name as staff_name
        FROM BookingItem bi
        LEFT JOIN Product p ON p.id = bi.product_id
        LEFT JOIN User u ON u.id = bi.staff_id
        WHERE bi.booking_id = ?
      `,
      args: [id!],
    })

    return NextResponse.json({
      success: true,
      data: {
        ...bookingResult.rows[0],
        items: itemsResult.rows,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
