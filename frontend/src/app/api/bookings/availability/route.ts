import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/bookings/availability?branch_id=&date=&product_id=
export const GET = withAuth(async (req, { user }) => {
  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branch_id')
    const date = searchParams.get('date')
    const productId = searchParams.get('product_id')

    if (!branchId || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required params: branch_id, date' },
        { status: 400 }
      )
    }

    // Build query for busy slots on that branch + date
    const conditions: string[] = [
      'b.branch_id = ?',
      "date(b.booking_start) = ?",
      'b.tenant_id = ?',
      "b.status NOT IN ('cancelled', 'no_show')",
    ]
    const args: (string | number)[] = [branchId, date, user.tenantId!]

    if (productId) {
      conditions.push('bi.product_id = ?')
      args.push(productId)
    }

    const where = conditions.join(' AND ')

    const result = await db.execute({
      sql: `
        SELECT DISTINCT b.id as booking_id, b.booking_start, b.booking_end, b.status
        FROM Booking b
        LEFT JOIN BookingItem bi ON bi.booking_id = b.id
        WHERE ${where}
        ORDER BY b.booking_start ASC
      `,
      args,
    })

    // Fetch branch open/close times for context
    const branchResult = await db.execute({
      sql: 'SELECT t.open_time, t.close_time FROM Branch br JOIN Tenant t ON t.id = br.tenant_id WHERE br.id = ?',
      args: [branchId],
    })

    const branchHours = branchResult.rows.length > 0
      ? { open_time: branchResult.rows[0].open_time, close_time: branchResult.rows[0].close_time }
      : null

    return NextResponse.json({
      success: true,
      data: {
        branch_id: branchId,
        date,
        business_hours: branchHours,
        busy_slots: result.rows,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
