import { db } from '@/lib/db'
import { signToken, verifyPin, hashPin } from '@/lib/token'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { pin } = await request.json()

    if (!pin || pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'PIN phải từ 4-6 số' }, { status: 400 })
    }

    const spas = await db.spa.findMany({ select: { id: true, name: true, pin: true } })
    const spa = spas.find((s) => verifyPin(String(pin), s.pin))

    if (!spa) {
      return NextResponse.json({ error: 'PIN không đúng' }, { status: 401 })
    }

    // Migrate plaintext PIN to hashed on first successful login
    if (!spa.pin.includes(':')) {
      await db.spa.update({ where: { id: spa.id }, data: { pin: hashPin(String(pin)) } })
    }

    const token = signToken(spa.id)

    const cookieStore = await cookies()
    cookieStore.set('spa_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ spa: { id: spa.id, name: spa.name }, token })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('spa_token')
  return NextResponse.json({ success: true })
}
