import crypto from 'crypto'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'

/** Sign a token for spaId. HMAC-SHA256 signed, base64url encoded. */
export function signToken(spaId: string): string {
  const ts = Date.now().toString()
  const payload = `${spaId}:${ts}`
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

/** Verify token. Returns spaId or null if invalid/expired (7 days). */
export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 3) return null
    const [spaId, ts, sig] = parts
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${spaId}:${ts}`)
      .digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null
    if (Date.now() - parseInt(ts, 10) > 7 * 24 * 60 * 60 * 1000) return null
    return spaId
  } catch {
    return null
  }
}

/** Hash a PIN for storage. Returns "salt:hash". */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify PIN against stored value.
 * Supports legacy plaintext PINs for zero-downtime migration.
 */
export function verifyPin(pin: string, stored: string): boolean {
  if (!stored.includes(':')) return pin === stored // legacy plaintext
  try {
    const [salt, hash] = stored.split(':')
    const derived = crypto.scryptSync(pin, salt, 32).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}
