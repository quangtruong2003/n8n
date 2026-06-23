import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const spaId = id

    const services = await db.service.findMany({
      where: { spaId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ services })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const spaId = id
    const body = await request.json()
    const { name, price, duration, description } = body

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Tên và giá là bắt buộc' }, { status: 400 })
    }

    const service = await db.service.create({
      data: { name, price: parseInt(String(price)), duration: duration ? parseInt(String(duration)) : null, description, spaId },
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
