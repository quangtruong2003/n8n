import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withAuth } from '../../../../lib/auth/middleware'
import { db } from '../../../../lib/db'

// GET /api/settings — Get global settings (super_admin only)
export const GET = withAuth(
  async (_req, { user }) => {
    try {
      const result = await db.execute({
        sql: `SELECT key, value, description FROM Setting WHERE tenant_id IS NULL ORDER BY key`,
        args: [],
      })

      const settings: Record<string, { value: string | null; description: string | null }> = {}
      for (const row of result.rows) {
        settings[row.key as string] = {
          value: row.value as string | null,
          description: row.description as string | null,
        }
      }

      return NextResponse.json({
        success: true,
        data: settings,
      })
    } catch (err) {
      console.error('Get global settings error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)

// PUT /api/settings — Upsert global settings (super_admin only)
interface SettingInput {
  key: string
  value: string | null
}

export const PUT = withAuth(
  async (req, { user }) => {
    try {
      const body = await req.json()
      const settings: SettingInput[] = body.settings

      if (!Array.isArray(settings) || settings.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Danh sách settings không hợp lệ' },
          { status: 400 }
        )
      }

      for (const setting of settings) {
        if (!setting.key || typeof setting.key !== 'string') {
          return NextResponse.json(
            { success: false, error: `Key không hợp lệ: ${JSON.stringify(setting)}` },
            { status: 400 }
          )
        }
      }

      for (const setting of settings) {
        await db.execute({
          sql: `INSERT INTO Setting (id, tenant_id, key, value, updated_at)
                VALUES (?, NULL, ?, ?, datetime('now'))
                ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
          args: [randomUUID(), setting.key, setting.value],
        })
      }

      // Audit log
      await db.execute({
        sql: `INSERT INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, new_value, created_at)
              VALUES (?, NULL, ?, 'update', 'global_settings', NULL, ?, datetime('now'))`,
        args: [
          randomUUID(),
          user.id,
          JSON.stringify(settings),
        ],
      })

      // Return updated settings
      const result = await db.execute({
        sql: `SELECT key, value, description FROM Setting WHERE tenant_id IS NULL ORDER BY key`,
        args: [],
      })

      const updated: Record<string, { value: string | null; description: string | null }> = {}
      for (const row of result.rows) {
        updated[row.key as string] = {
          value: row.value as string | null,
          description: row.description as string | null,
        }
      }

      return NextResponse.json({
        success: true,
        data: updated,
      })
    } catch (err) {
      console.error('Update global settings error:', err)
      return NextResponse.json(
        { success: false, error: 'Lỗi server' },
        { status: 500 }
      )
    }
  },
  { requiredRole: ['super_admin'] }
)
