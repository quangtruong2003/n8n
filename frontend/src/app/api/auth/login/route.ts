import { db } from '@/lib/db'
import { signToken } from '@/lib/auth/jwt'
import { verifyPin, hashPin } from '@/lib/auth/password'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { pin } = await request.json()

    if (!pin || pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'PIN phải từ 4-6 số' }, { status: 400 })
    }

    const result = await db.execute({
      sql: `SELECT id, name, pin FROM Spa`,
      args: []
    })

    let foundSpa = null
    for (const row of result.rows) {
      const storedPin = row.pin as string | null
      if (storedPin && verifyPin(String(pin), storedPin)) {
        foundSpa = row
        break
      }
    }

    if (!foundSpa) {
      return NextResponse.json({ error: 'PIN không đúng' }, { status: 401 })
    }

    const spaId = foundSpa.id as string
    const spaName = foundSpa.name as string

    const token = signToken({ userId: spaId, tenantId: spaId, role: 'spa' })

    const cookieStore = await cookies()
    cookieStore.set('spa_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ spa: { id: spaId, name: spaName }, token })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('spa_token')
  return NextResponse.json({ success: true })
}
