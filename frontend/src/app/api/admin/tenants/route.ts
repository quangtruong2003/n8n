import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { hashPassword } from '../../../../lib/auth/password'
import { db } from '../../../../lib/db'

// GET /api/admin/tenants — List all tenants (super_admin only)
export const GET = withAuth(
  async (req) => {
    try {
      const url = req.nextUrl
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
      const offset = (page - 1) * limit

      const countResult = await db.execute({
        sql: 'SELECT COUNT(*) as total FROM Tenant',
        args: [],
      })
      const total = (countResult.rows[0].total as number) || 0

      const result = await db.execute({
        sql: 'SELECT * FROM Tenant ORDER BY created_at DESC LIMIT ? OFFSET ?',
        args: [limit, offset],
      })

      return NextResponse.json({
        success: true,
        data: result.rows,
        meta: { total, page, limit },
      })
    } catch (err) {
      console.error('List tenants error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)

// POST /api/admin/tenants — Create tenant + owner (super_admin only)
export const POST = withAuth(
  async (req, { user }) => {
    try {
      const body = await req.json()
      const { name, slug, business_type, owner } = body

      // 1. Validate input
      if (!name || !slug || !business_type) {
        return NextResponse.json(
          { success: false, error: 'Thiếu thông tin: name, slug, business_type là bắt buộc' },
          { status: 400 }
        )
      }

      if (!owner?.username || !owner?.password || !owner?.name) {
        return NextResponse.json(
          { success: false, error: 'Thiếu thông tin owner: username, password, name là bắt buộc' },
          { status: 400 }
        )
      }

      const validTypes = ['spa', 'retail', 'fnb', 'rental', 'service', 'other']
      if (!validTypes.includes(business_type)) {
        return NextResponse.json(
          { success: false, error: `business_type phải là một trong: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }

      // 2. Check slug unique BEFORE transaction
      const existing = await db.execute({
        sql: 'SELECT id FROM Tenant WHERE slug = ?',
        args: [slug],
      })
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Slug đã tồn tại' },
          { status: 409 }
        )
      }

      // 3. Check username unique
      const existingUser = await db.execute({
        sql: 'SELECT id FROM User WHERE username = ?',
        args: [owner.username],
      })
      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Username đã tồn tại' },
          { status: 409 }
        )
      }

      // 4. Generate IDs and hash password
      const tenantId = randomUUID()
      const ownerId = randomUUID()
      const branchId = randomUUID()
      const botConfigId = randomUUID()
      const roleManagerId = randomUUID()
      const roleStaffId = randomUUID()
      const passwordHash = await hashPassword(owner.password)

      // 5. Build transaction statements
      const statements = [
        // Insert Tenant
        {
          sql: `INSERT INTO Tenant (id, name, slug, business_type, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
          args: [tenantId, name, slug, business_type],
        },
        // Insert Owner User
        {
          sql: `INSERT INTO User (id, username, password_hash, role, tenant_id, full_name, active, created_at, updated_at)
                VALUES (?, ?, ?, 'owner', ?, ?, 1, datetime('now'), datetime('now'))`,
          args: [ownerId, owner.username, passwordHash, tenantId, owner.name],
        },
        // Insert main Branch
        {
          sql: `INSERT INTO Branch (id, tenant_id, name, is_main, active, created_at, updated_at)
                VALUES (?, ?, 'Chi nhánh chính', 1, 1, datetime('now'), datetime('now'))`,
          args: [branchId, tenantId],
        },
        // Insert BotConfig
        {
          sql: `INSERT INTO BotConfig (id, tenant_id, bot_name, greeting, ai_enabled, ai_model, channels, created_at, updated_at)
                VALUES (?, ?, 'Trợ lý ảo', 'Xin chào! Tôi có thể giúp gì cho bạn?', 1, 'openai/gpt-4o-mini', '["web"]', datetime('now'), datetime('now'))`,
          args: [botConfigId, tenantId],
        },
        // Insert Role: Quản lý
        {
          sql: `INSERT INTO Role (id, tenant_id, name, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          args: [roleManagerId, tenantId, 'Quản lý', 'Toàn quyền quản lý'],
        },
        // Insert Role: Nhân viên
        {
          sql: `INSERT INTO Role (id, tenant_id, name, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          args: [roleStaffId, tenantId, 'Nhân viên', 'Quyền hạn chế'],
        },
        // Link owner to main branch
        {
          sql: 'INSERT INTO UserBranch (user_id, branch_id) VALUES (?, ?)',
          args: [ownerId, branchId],
        },
        // AuditLog
        {
          sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, created_at)
                VALUES (?, ?, ?, 'create', 'tenant', ?, datetime('now'))`,
          args: [randomUUID(), tenantId, user.id, tenantId],
        },
      ]

      // 6. Execute transaction
      await db.batch(
        statements.map((s) => ({ sql: s.sql, args: s.args as (string | number | null)[] })),
        'write'
      )

      return NextResponse.json({
        success: true,
        data: {
          tenant: { id: tenantId, name, slug, business_type },
          owner: { id: ownerId, username: owner.username, role: 'owner' },
          branch: { id: branchId, name: 'Chi nhánh chính', is_main: 1 },
        },
      }, { status: 201 })
    } catch (err) {
      console.error('Create tenant error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)
