import { createClient } from '@libsql/client'

const globalForClient = globalThis as unknown as {
  client: ReturnType<typeof createClient> | undefined
}

function createDbClient() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error('DATABASE_URL is not defined')
  }

  return createClient({
    url,
    authToken,
  })
}

export const db = globalForClient.client ?? createDbClient()

if (process.env.NODE_ENV !== 'production') {
  globalForClient.client = db
}

export type { ResultSet } from '@libsql/client'
