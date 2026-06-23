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
    const page = parseInt(searchParams.get('page') || '1')
    const status = searchParams.get('status') || ''
    const branchId = searchParams.get('branchId') || ''
    const pageSize = 20

    const where: Record<string, unknown> = { spaId }
    if (status && status !== 'all') {
      where.status = status
    }
    if (branchId) {
      where.branchId = branchId
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true, service: true, branch: true },
      }),
      db.booking.count({ where }),
    ])

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        customerName: b.customer.name,
        customerPhone: b.customer.phone,
        serviceName: b.service.name,
        servicePrice: b.service.price,
        branchName: b.branch?.name || 'N/A',
        status: b.status,
        bookingTime: b.bookingTime,
        note: b.note,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
