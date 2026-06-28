import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JwtPayload } from './jwt'
import { db } from '../db'

export interface AuthUser {
  id: string
  username: string
  role: string
  tenantId: string | null
  active: number
}

type AuthHandler = (
  req: NextRequest,
  ctx: { user: AuthUser }
) => Promise<NextResponse>

interface WithAuthOptions {
  requiredRole?: string[]
  requiredPermission?: { resource: string; action: string }
}

const ACTION_TO_COLUMN: Record<string, string> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
}

function unauthorized(message: string): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

function forbidden(message: string): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 })
}

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return req.cookies.get('session_token')?.value ?? null
}

export function withAuth(
  handler: AuthHandler,
  options?: WithAuthOptions
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    // 1. Extract token
    const token = extractToken(req)
    if (!token) {
      return unauthorized('Missing authentication token')
    }

    // 2. Verify JWT
    const payload: JwtPayload | null = verifyToken(token)
    if (!payload) {
      return unauthorized('Invalid or expired token')
    }

    // 3. Query user, check active
    const result = await db.execute({
      sql: 'SELECT id, username, role, tenant_id, active FROM User WHERE id = ?',
      args: [payload.userId],
    })

    if (result.rows.length === 0) {
      return unauthorized('User not found')
    }

    const row = result.rows[0]
    if (row.active !== 1) {
      return unauthorized('Account is deactivated')
    }

    const user: AuthUser = {
      id: row.id as string,
      username: row.username as string,
      role: row.role as string,
      tenantId: row.tenant_id as string | null,
      active: row.active as number,
    }

    // 4. Role check
    if (options?.requiredRole) {
      if (user.role !== 'super_admin' && !options.requiredRole.includes(user.role)) {
        return forbidden('Insufficient role')
      }
    }

    // 5. Permission check
    if (options?.requiredPermission) {
      if (user.role !== 'super_admin') {
        const { resource, action } = options.requiredPermission
        const column = ACTION_TO_COLUMN[action]
        if (!column) {
          return forbidden('Invalid permission action')
        }

        const permResult = await db.execute({
          sql: `
            SELECT p.${column} as allowed
            FROM Permission p
            JOIN Role r ON r.id = p.role_id
            WHERE r.name = ? AND r.tenant_id = ? AND p.resource = ?
          `,
          args: [user.role, user.tenantId, resource],
        })

        if (permResult.rows.length === 0 || permResult.rows[0].allowed !== 1) {
          return forbidden('Insufficient permission')
        }
      }
    }

    // 6. All checks passed
    return handler(req, { user })
  }
}
