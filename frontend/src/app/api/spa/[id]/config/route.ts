import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const spaId = id
    const body = await request.json()
    const { name, phone, openTime, closeTime, botActive, botGreeting, botName } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (openTime !== undefined) data.openTime = openTime
    if (closeTime !== undefined) data.closeTime = closeTime
    if (botActive !== undefined) data.botActive = botActive

    await db.spa.update({ where: { id: spaId }, data })

    // Update config if provided
    if (botGreeting !== undefined || botName !== undefined) {
      const configData: Record<string, unknown> = {}
      if (botGreeting !== undefined) configData.botGreeting = botGreeting
      if (botName !== undefined) configData.botName = botName

      await db.spaConfig.upsert({
        where: { spaId },
        update: configData,
        create: { spaId, ...configData },
      })
    }

    const updated = await db.spa.findUnique({
      where: { id: spaId },
      include: { config: true, branches: true },
    })

    return NextResponse.json({ spa: updated })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
