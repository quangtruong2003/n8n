import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { verifyPassword, hashPassword } from '../../../../lib/auth/password'
import { db } from '../../../../lib/db'

export const PUT = withAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const { current_password, new_password } = body

    if (!current_password || !new_password) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' },
        { status: 400 }
      )
    }

    if (typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
        { status: 400 }
      )
    }

    // 1. Fetch current password hash
    const userResult = await db.execute({
      sql: 'SELECT id, password_hash, tenant_id FROM User WHERE id = ?',
      args: [user.id],
    })

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy người dùng' },
        { status: 404 }
      )
    }

    // 2. Verify current password
    const isValid = await verifyPassword(current_password, userResult.rows[0].password_hash as string)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu hiện tại không đúng' },
        { status: 400 }
      )
    }

    // 3. Hash new password and update
    const newHash = await hashPassword(new_password)
    await db.execute({
      sql: 'UPDATE User SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?',
      args: [newHash, user.id],
    })

    // 4. Delete all sessions of this user (force re-login)
    await db.execute({
      sql: 'DELETE FROM Session WHERE user_id = ?',
      args: [user.id],
    })

    // 5. Audit log
    const tenantId = userResult.rows[0].tenant_id as string
    await db.execute({
      sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, created_at)
            VALUES (?, ?, ?, 'update', 'user', ?, datetime('now'))`,
      args: [randomUUID(), tenantId, user.id, user.id],
    })

    return NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    })
  } catch (err) {
    console.error('Change password error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
