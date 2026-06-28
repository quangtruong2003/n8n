// ─── Widget Session Management ────────────────────────────────
// Manages chat session IDs in localStorage for the embeddable widget.
// Each spa slug gets its own session key: gw_chat_{slug}_session

interface SessionEntry {
  sessionId: string
  createdAt: number
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function storageKey(slug: string): string {
  return `gw_chat_${slug}_session`
}

/**
 * Get existing session ID or create new one if missing/expired.
 * ponytail: crypto.randomUUID() requires HTTPS context.
 *           upgrade path: server-side session generation for HTTP sites.
 */
export function getSessionId(slug: string): string {
  const existing = loadSession(slug)
  if (existing && Date.now() - existing.createdAt < SESSION_TTL_MS) {
    return existing.sessionId
  }
  // expired or missing — create new
  const newId = crypto.randomUUID()
  saveSessionId(slug, newId)
  return newId
}

/** Save session ID with current timestamp to localStorage. */
export function saveSessionId(slug: string, sessionId: string): void {
  const entry: SessionEntry = { sessionId, createdAt: Date.now() }
  localStorage.setItem(storageKey(slug), JSON.stringify(entry))
}

/** Remove session entry from localStorage. */
export function clearSession(slug: string): void {
  localStorage.removeItem(storageKey(slug))
}

// ─── Internal ─────────────────────────────────────────────────

function loadSession(slug: string): SessionEntry | null {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionEntry
    if (!parsed.sessionId || !parsed.createdAt) return null
    return parsed
  } catch {
    return null
  }
}
