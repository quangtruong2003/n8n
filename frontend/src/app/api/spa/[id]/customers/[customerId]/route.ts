import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id, customerId } = await params
    const spaId = id

    const [chatLogs, bookings] = await Promise.all([
      db.chatLog.findMany({
        where: { spaId, customerId },
        orderBy: { createdAt: 'asc' },
        include: { branch: true },
      }),
      db.booking.findMany({
        where: { spaId, customerId },
        orderBy: { createdAt: 'desc' },
        include: { service: true, branch: true },
      }),
    ])

    return NextResponse.json({
      chatLogs: chatLogs.map((l) => ({
        id: l.id,
        sender: l.sender,
        content: l.content,
        branchName: l.branch?.name || 'N/A',
        createdAt: l.createdAt,
      })),
      bookings: bookings.map((b) => ({
        id: b.id,
        serviceName: b.service.name,
        servicePrice: b.service.price,
        branchName: b.branch?.name || 'N/A',
        status: b.status,
        bookingTime: b.bookingTime,
        note: b.note,
        createdAt: b.createdAt,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
