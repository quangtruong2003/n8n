import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id, serviceId } = await params
    const spaId = id
    const body = await request.json()
    const { name, price, duration, description, active } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (price !== undefined) data.price = parseInt(String(price))
    if (duration !== undefined) data.duration = duration ? parseInt(String(duration)) : null
    if (description !== undefined) data.description = description
    if (active !== undefined) data.active = active

    const service = await db.service.update({
      where: { id: serviceId, spaId },
      data,
    })

    return NextResponse.json({ service })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id, serviceId } = await params
    const spaId = id

    await db.service.delete({ where: { id: serviceId, spaId } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
