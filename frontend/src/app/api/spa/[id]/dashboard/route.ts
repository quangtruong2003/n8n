import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: spaId } = await params
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const branchFilter = branchId ? { branchId } : {}

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [messagesToday, newBookingsToday, pendingBookings, totalBookings, convertedBookings, rawHourly, recentPendingBookings] =
      await Promise.all([
        db.chatLog.count({ where: { spaId, ...branchFilter, createdAt: { gte: today, lt: tomorrow }, sender: 'user' } }),
        db.booking.count({ where: { spaId, ...branchFilter, createdAt: { gte: today, lt: tomorrow } } }),
        db.booking.count({ where: { spaId, ...branchFilter, status: 'pending' } }),
        db.booking.count({ where: { spaId, ...branchFilter } }),
        db.booking.count({ where: { spaId, ...branchFilter, status: { in: ['confirmed', 'completed'] } } }),
        // Single query for all chat logs today, group by hour in JS
        db.chatLog.findMany({
          where: { spaId, ...branchFilter, sender: 'user', createdAt: { gte: today, lt: tomorrow } },
          select: { createdAt: true },
        }),
        db.booking.findMany({
          where: { spaId, ...branchFilter, status: 'pending' },
          include: { customer: true, service: true, branch: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

    const conversionRate = totalBookings > 0 ? Math.round((convertedBookings / totalBookings) * 100) : 0

    // Group by hour in JS — 1 query instead of 24
    const hourlyCounts = new Array(24).fill(0)
    for (const log of rawHourly) {
      hourlyCounts[log.createdAt.getHours()]++
    }
    const hourlyData = hourlyCounts.map((count, hour) => ({ hour, count }))

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
