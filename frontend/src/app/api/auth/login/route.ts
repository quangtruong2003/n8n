import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { pin } = await request.json()

    if (!pin || pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'PIN phải từ 4-6 số' }, { status: 400 })
    }

    const spa = await db.spa.findFirst({ where: { pin } })

    if (!spa) {
      return NextResponse.json({ error: 'PIN không đúng' }, { status: 401 })
    }

    const token = Buffer.from(`${spa.id}:${Date.now()}`).toString('base64')

    const cookieStore = await cookies()
    cookieStore.set('spa_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({
      spa: { id: spa.id, name: spa.name },
      token,
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('spa_token')
  return NextResponse.json({ success: true })
}
