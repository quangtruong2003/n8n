import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  try {
    const { id, bookingId } = await params
    const spaId = id
    const body = await request.json()
    const { status } = body

    if (!['confirmed', 'cancelled', 'completed', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Trạng thái không hợp lệ' }, { status: 400 })
    }

    const booking = await db.booking.update({
      where: { id: bookingId, spaId },
      data: { status },
      include: { customer: true, service: true },
    })

    return NextResponse.json({
      booking: {
        id: booking.id,
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        status: booking.status,
        updatedAt: booking.updatedAt,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
