import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../../lib/auth/middleware'
import { db } from '../../../../../lib/db'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
}

// PATCH /api/bookings/:id/status
export const PATCH = withAuth(async (req, { user }) => {
  try {
    const segments = req.nextUrl.pathname.split('/')
    // /api/bookings/[id]/status -> segments[3] = id
    const bookingId = segments[3]

    const { status: newStatus } = (await req.json()) as { status?: string }

    if (!newStatus) {
      return NextResponse.json({ success: false, error: 'Missing status' }, { status: 400 })
    }

    // Fetch booking
    const bookingResult = await db.execute({
      sql: 'SELECT * FROM Booking WHERE id = ? AND tenant_id = ?',
      args: [bookingId, user.tenantId!],
    })

    if (bookingResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const booking = bookingResult.rows[0]
    const currentStatus = booking.status as string

    // Validate transition
    const allowed = VALID_TRANSITIONS[currentStatus]
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Cannot transition from '${currentStatus}' to '${newStatus}'` },
        { status: 400 }
      )
    }

    // On cancelled: block if order already linked
    if (newStatus === 'cancelled' && booking.order_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a booking that already has a linked order' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // On completed: auto-create Order
    let orderId: string | null = null
    if (newStatus === 'completed') {
      orderId = randomUUID()
      const orderCode = `ORD-${Date.now()}`

      // Fetch booking items with product prices
      const itemsResult = await db.execute({
        sql: 'SELECT bi.*, p.price as product_price, p.name as product_name FROM BookingItem bi JOIN Product p ON p.id = bi.product_id WHERE bi.booking_id = ?',
        args: [bookingId],
      })

      let subtotal = 0
      const orderItems: { id: string; product_id: string; quantity: number; unit_price: number; total: number }[] = []

      for (const item of itemsResult.rows) {
        const unitPrice = Number(item.product_price)
        const quantity = Number(item.quantity)
        const itemTotal = unitPrice * quantity
        subtotal += itemTotal
        orderItems.push({
          id: randomUUID(),
          product_id: item.product_id as string,
          quantity,
          unit_price: unitPrice,
          total: itemTotal,
        })
      }

      // Create Order
      await db.execute({
        sql: `
          INSERT INTO "Order" (id, tenant_id, branch_id, customer_id, user_id, order_code, status, subtotal, total, payment_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'unpaid', ?, ?)
        `,
        args: [orderId, user.tenantId!, booking.branch_id as string, booking.customer_id as string, user.id, orderCode, subtotal, subtotal, now, now],
      })

      // Create OrderItems
      for (const oi of orderItems) {
        await db.execute({
          sql: `
            INSERT INTO OrderItem (id, order_id, product_id, quantity, unit_price, total, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          args: [oi.id, orderId, oi.product_id, oi.quantity, oi.unit_price, oi.total, now],
        })
      }

      // Link order to booking
      await db.execute({
        sql: 'UPDATE Booking SET order_id = ?, status = ?, updated_at = ? WHERE id = ?',
        args: [orderId, newStatus, now, bookingId],
      })
    } else {
      // Simple status update
      await db.execute({
        sql: 'UPDATE Booking SET status = ?, updated_at = ? WHERE id = ?',
        args: [newStatus, now, bookingId],
      })
    }

    // Audit log
    await db.execute({
      sql: `
        INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES (?, ?, ?, 'update', 'Booking', ?, ?, ?, ?)
      `,
      args: [
        randomUUID(),
        user.tenantId!,
        user.id,
        bookingId,
        JSON.stringify({ status: currentStatus }),
        JSON.stringify({ status: newStatus, order_id: orderId }),
        now,
      ],
    })

    // Fetch updated booking
    const updated = await db.execute({
      sql: 'SELECT * FROM Booking WHERE id = ?',
      args: [bookingId],
    })

    return NextResponse.json({ success: true, data: updated.rows[0] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
