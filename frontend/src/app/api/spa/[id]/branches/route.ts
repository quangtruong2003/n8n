import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const spaId = id

    const branches = await db.branch.findMany({
      where: { spaId },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ branches })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
