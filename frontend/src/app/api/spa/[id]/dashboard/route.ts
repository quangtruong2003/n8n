import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const spaId = id
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const branchFilter = branchId ? { branchId } : {}

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const messagesToday = await db.chatLog.count({
      where: { spaId, ...branchFilter, createdAt: { gte: today, lt: tomorrow }, sender: 'user' },
    })

    const newBookingsToday = await db.booking.count({
      where: { spaId, ...branchFilter, createdAt: { gte: today, lt: tomorrow } },
    })

    const pendingBookings = await db.booking.count({
      where: { spaId, ...branchFilter, status: 'pending' },
    })

    const totalBookings = await db.booking.count({ where: { spaId, ...branchFilter } })
    const convertedBookings = await db.booking.count({
      where: { spaId, ...branchFilter, status: { in: ['confirmed', 'completed'] } },
    })
    const conversionRate = totalBookings > 0 ? Math.round((convertedBookings / totalBookings) * 100) : 0

    const hourlyData: { hour: number; count: number }[] = []
    for (let h = 0; h < 24; h++) {
      const hourStart = new Date(today)
      hourStart.setHours(h, 0, 0, 0)
      const hourEnd = new Date(today)
      hourEnd.setHours(h, 59, 59, 999)
      const count = await db.chatLog.count({
        where: { spaId, ...branchFilter, sender: 'user', createdAt: { gte: hourStart, lt: hourEnd } },
      })
      hourlyData.push({ hour: h, count })
    }

    const recentPendingBookings = await db.booking.findMany({
      where: { spaId, ...branchFilter, status: 'pending' },
      include: { customer: true, service: true, branch: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      stats: { messagesToday, newBookingsToday, pendingBookings, conversionRate },
      hourlyData,
      recentPendingBookings: recentPendingBookings.map((b) => ({
        id: b.id,
        customerName: b.customer.name,
        customerPhone: b.customer.phone,
        serviceName: b.service.name,
        servicePrice: b.service.price,
        branchName: b.branch?.name || 'N/A',
        bookingTime: b.bookingTime,
        status: b.status,
        note: b.note,
        createdAt: b.createdAt,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
