import { db } from '../db'

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.execute({
    sql: `DELETE FROM Session WHERE expires_at < datetime('now')`,
    args: [],
  })

  const deleted = result.rowsAffected
  if (deleted > 0) {
    console.log(`[session-cleanup] Removed ${deleted} expired session(s)`)
  }

  return deleted
}
