import { db } from '@/lib/db'
import { verifyToken } from '@/lib/token'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get('spa_token')?.value
    const raw = headerToken ?? cookieToken ?? null

    const spaId = raw ? verifyToken(raw) : null
    if (!spaId) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const spa = await db.spa.findUnique({
      where: { id: spaId },
      include: { config: true, branches: true },
    })
    if (!spa) return NextResponse.json({ error: 'Không tìm thấy spa' }, { status: 404 })

    return NextResponse.json({
      spa: {
        id: spa.id, name: spa.name, phone: spa.phone,
        openTime: spa.openTime, closeTime: spa.closeTime,
        botActive: spa.botActive, config: spa.config, branches: spa.branches,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
