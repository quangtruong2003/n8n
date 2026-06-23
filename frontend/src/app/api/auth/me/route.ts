import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function extractSpaId(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const decoded = Buffer.from(token, 'base64').toString()
      return decoded.split(':')[0] || null
    } catch {
      return null
    }
  }
  return null
}

export async function GET(request: Request) {
  try {
    // Try Authorization header first
    let spaId = extractSpaId(request)

    // Fallback to cookie
    if (!spaId) {
      const cookieStore = await cookies()
      const token = cookieStore.get('spa_token')?.value
      if (token) {
        try {
          const decoded = Buffer.from(token, 'base64').toString()
          spaId = decoded.split(':')[0] || null
        } catch {
          // ignore
        }
      }
    }

    if (!spaId) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const spa = await db.spa.findUnique({
      where: { id: spaId },
      include: { config: true, branches: true },
    })

    if (!spa) {
      return NextResponse.json({ error: 'Không tìm thấy spa' }, { status: 404 })
    }

    return NextResponse.json({
      spa: {
        id: spa.id,
        name: spa.name,
        phone: spa.phone,
        openTime: spa.openTime,
        closeTime: spa.closeTime,
        botActive: spa.botActive,
        config: spa.config,
        branches: spa.branches,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
