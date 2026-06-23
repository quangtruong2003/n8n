import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/token'

/** Routes that require auth */
const PROTECTED = /^\/api\/spa\//

export function middleware(request: NextRequest) {
  if (!PROTECTED.test(request.nextUrl.pathname)) return NextResponse.next()

  // Extract spaId from URL: /api/spa/[id]/...
  const segments = request.nextUrl.pathname.split('/')
  const urlSpaId = segments[3] // ["", "api", "spa", "<id>", ...]

  // Get token from header or cookie
  const authHeader = request.headers.get('Authorization')
  const raw = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.cookies.get('spa_token')?.value ?? null

  const tokenSpaId = raw ? verifyToken(raw) : null

  if (!tokenSpaId) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // Ownership check: token must belong to the spa being accessed
  if (urlSpaId && tokenSpaId !== urlSpaId) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/spa/:path*'],
}
