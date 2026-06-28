import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES = '24h'

export interface JwtPayload {
  userId: string
  tenantId: string | null
  role: string
}

/** Create a signed JWT with 24-hour expiry. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

/** Verify a JWT and return its payload, or null on any failure. */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (typeof decoded === 'string') return null
    const { userId, tenantId, role } = decoded as JwtPayload
    if (!userId || typeof role !== 'string') return null
    return { userId, tenantId: tenantId ?? null, role }
  } catch {
    return null
  }
}
