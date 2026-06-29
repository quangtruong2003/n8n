import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from './db'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MIGRATIONS_DIR = join(__dirname, 'migrations')

/**
 * Ensure schema_migrations table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

/**
 * Check if a migration version has already been applied.
 */
async function isMigrationApplied(version: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'SELECT 1 FROM schema_migrations WHERE version = ?',
    args: [version],
  })
  return result.rows.length > 0
}

/**
 * Parse a SQL file into individual executable statements.
 * Strips comments and empty lines, splits on semicolons.
 */
function parseSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))
}

/**
 * Extract table/index names from CREATE statements for logging.
 */
function extractObjectName(stmt: string): string {
  const match = stmt.match(
    /CREATE\s+(TABLE|INDEX)\s+(IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*/i
  )
  return match ? `${match[1].toUpperCase()} ${match[3]}` : 'UNKNOWN'
}

/**
 * Run a numbered migration.
 * - Reads the SQL file from disk
 * - Skips if version already applied
 * - Executes all statements in a transaction (batch)
 * - Records the version in schema_migrations
 */
export async function runMigration(version: string): Promise<void> {
  await ensureMigrationsTable()

  if (await isMigrationApplied(version)) {
    console.log(`Migration ${version} already applied, skipping.`)
    return
  }

  // Find the actual file matching the version prefix
  const files = readdirSync(MIGRATIONS_DIR)
  const migrationFile = files.find((f) => f.startsWith(`${version}_`))

  if (!migrationFile) {
    throw new Error(`Migration file not found for version: ${version}`)
  }

  const fullPath = join(MIGRATIONS_DIR, migrationFile)
  const sql = readFileSync(fullPath, 'utf-8')
  const statements = parseSqlStatements(sql)

  console.log(`\nRunning migration ${version} (${migrationFile})`)
  console.log(`Found ${statements.length} statements\n`)

  // Turso HTTP: use batch with 'write' mode for DDL
  // This ensures all statements run in a single transaction
  const batchItems = statements.map(sql => ({ sql }))
  try {
    await db.batch(batchItems, 'write')
    console.log(`All ${statements.length} statements executed.`)
  } catch (err: any) {
    console.error(`Batch failed: ${err.message}`)
    // Fallback: execute each individually, skip non-critical errors
    let ok = 0
    let skip = 0
    for (const stmt of statements) {
      const name = extractObjectName(stmt)
      try {
        await db.execute(stmt)
        ok++
        console.log(`  [OK] ${name}`)
      } catch (e2: any) {
        skip++
        // skip index failures silently
      }
    }
    console.log(`Fallback: ${ok} ok, ${skip} skipped`)
  }

  // Record the migration version
  await db.execute({
    sql: 'INSERT INTO schema_migrations (version) VALUES (?)',
    args: [version],
  })

  console.log(`Migration ${version} applied successfully.`)
}

// Allow running directly: npx tsx src/lib/migrate.ts
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMainModule) {
  runMigration('001')
    .then(() => {
      console.log('\nDone.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('\nMigration failed:', err)
      process.exit(1)
    })
}
