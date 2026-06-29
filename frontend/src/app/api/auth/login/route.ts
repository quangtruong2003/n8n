import { db } from '@/lib/db'
import { signToken } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Thiếu tài khoản hoặc mật khẩu' }, { status: 400 })
    }

    // Query User table
    const result = await db.execute({
      sql: `SELECT u.id, u.username, u.password_hash, u.role, u.tenant_id, u.full_name,
                   t.name as tenant_name, t.slug as tenant_slug
            FROM "User" u
            LEFT JOIN Tenant t ON u.tenant_id = t.id
            WHERE u.username = ? AND u.active = 1`,
      args: [username]
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 401 })
    }

    const user = result.rows[0]
    const passwordHash = user.password_hash as string

    const valid = await verifyPassword(password, passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Mật khẩu không đúng' }, { status: 401 })
    }

    const token = signToken({
      userId: user.id as string,
      tenantId: (user.tenant_id as string) || null,
      role: user.role as string
    })

    const cookieStore = await cookies()
    cookieStore.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
      },
      tenant: user.tenant_id ? {
        id: user.tenant_id,
        name: user.tenant_name,
        slug: user.tenant_slug,
      } : null
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('session_token')
  return NextResponse.json({ success: true })
}
