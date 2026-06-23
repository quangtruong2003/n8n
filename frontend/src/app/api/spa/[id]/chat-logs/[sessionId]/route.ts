import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id, sessionId } = await params
    const spaId = id

    const logs = await db.chatLog.findMany({
      where: { spaId, sessionId },
      orderBy: { createdAt: 'asc' },
      include: { customer: true, branch: true },
    })

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        customerName: l.customer.name,
        sender: l.sender,
        content: l.content,
        branchName: l.branch?.name || 'N/A',
        createdAt: l.createdAt,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
