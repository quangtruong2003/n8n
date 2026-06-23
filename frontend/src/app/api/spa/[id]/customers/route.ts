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
    const search = searchParams.get('search') || ''
    const pageSize = 20

    const where: Record<string, unknown> = { spaId }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { bookings: true, chatLogs: true } },
        },
      }),
      db.customer.count({ where }),
    ])

    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        bookingCount: c._count.bookings,
        chatCount: c._count.chatLogs,
        createdAt: c.createdAt,
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
