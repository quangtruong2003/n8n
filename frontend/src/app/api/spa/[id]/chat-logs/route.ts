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
    const date = searchParams.get('date') || ''
    const sender = searchParams.get('sender') || ''
    const branchId = searchParams.get('branchId') || ''
    const pageSize = 20

    const where: Record<string, unknown> = { spaId }
    if (date) {
      const d = new Date(date)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.createdAt = { gte: d, lt: next }
    }
    if (sender) {
      where.sender = sender
    }
    if (branchId) {
      where.branchId = branchId
    }

    const [logs, total] = await Promise.all([
      db.chatLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true, branch: true },
      }),
      db.chatLog.count({ where }),
    ])

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        customerName: l.customer.name,
        customerPhone: l.customer.phone,
        branchName: l.branch?.name || 'N/A',
        sender: l.sender,
        content: l.content,
        sessionId: l.sessionId,
        createdAt: l.createdAt,
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
