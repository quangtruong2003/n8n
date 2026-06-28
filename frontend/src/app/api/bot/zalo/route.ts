import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'
import { connectZalo, disconnectZalo } from '../../../../lib/chat/zalo'

// ─── AES-256-GCM Cookie Encryption ─────────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64-char hex (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

// ponytail: decrypt() omitted — not needed for current flow.
// Add when admin needs to view raw cookies or pass them to reconnectZalo.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}

// ─── POST /api/bot/zalo ────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const body = await req.json()
    const { action, cookies, imei, user_agent } = body as {
      action: string
      cookies?: string
      imei?: string
      user_agent?: string
    }

    if (!action || !['connect', 'disconnect', 'status'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action phải là connect | disconnect | status' },
        { status: 400 },
      )
    }

    // Owner-only check
    if (user.role !== 'owner' && user.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Chỉ owner mới có thể quản lý kết nối Zalo' },
        { status: 403 },
      )
    }

    const tenantId = user.tenantId!
    const now = new Date().toISOString()

    // ── CONNECT ────────────────────────────────────────────
    if (action === 'connect') {
      if (!cookies || typeof cookies !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Thiếu cookies (string JSON)' },
          { status: 400 },
        )
      }

      // Validate JSON format
      let parsed: Record<string, string>
      try {
        parsed = JSON.parse(cookies)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Cookies không đúng định dạng JSON' },
          { status: 400 },
        )
      }

      if (Object.keys(parsed).length === 0) {
        return NextResponse.json(
          { success: false, error: 'Cookies rỗng' },
          { status: 400 },
        )
      }

      // Encrypt cookies before storing
      const encryptedCookies = encrypt(cookies)

      // Update BotConfig
      await db.execute({
        sql: `UPDATE BotConfig
              SET zalo_cookies = ?, zalo_imei = ?, zalo_user_agent = ?, zalo_connected = 1, updated_at = ?
              WHERE tenant_id = ?`,
        args: [encryptedCookies, imei ?? '', user_agent ?? '', now, tenantId],
      })

      // Connect Zalo via library
      const success = await connectZalo(tenantId, parsed, imei ?? '', user_agent ?? '')

      if (!success) {
        // Rollback on failure
        await db.execute({
          sql: `UPDATE BotConfig SET zalo_connected = 0, updated_at = ? WHERE tenant_id = ?`,
          args: [now, tenantId],
        })
        return NextResponse.json(
          { success: false, error: 'Kết nối Zalo thất bại. Kiểm tra cookies và thử lại.' },
          { status: 400 },
        )
      }

      return NextResponse.json({
        success: true,
        data: { zalo_connected: 1, message: 'Kết nối Zalo thành công' },
      })
    }

    // ── DISCONNECT ─────────────────────────────────────────
    if (action === 'disconnect') {
      disconnectZalo(tenantId)

      await db.execute({
        sql: `UPDATE BotConfig
              SET zalo_connected = 0, zalo_cookies = NULL, zalo_imei = NULL, zalo_user_agent = NULL, zalo_account_name = NULL, updated_at = ?
              WHERE tenant_id = ?`,
        args: [now, tenantId],
      })

      return NextResponse.json({
        success: true,
        data: { zalo_connected: 0, message: 'Ngắt kết nối Zalo thành công' },
      })
    }

    // ── STATUS ─────────────────────────────────────────────
    const result = await db.execute({
      sql: `SELECT zalo_connected, zalo_account_name FROM BotConfig WHERE tenant_id = ?`,
      args: [tenantId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cấu hình bot' },
        { status: 404 },
      )
    }

    const row = result.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        zalo_connected: row.zalo_connected,
        zalo_account_name: row.zalo_account_name ?? null,
      },
    })
  } catch (err) {
    console.error('[Bot Zalo] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server nội bộ' },
      { status: 500 },
    )
  }
})
