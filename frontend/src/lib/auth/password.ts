import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
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
