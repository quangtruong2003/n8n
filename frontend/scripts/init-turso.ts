import { createClient } from '@libsql/client'

const client = createClient({
  url: 'libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODI2NTIwNzQsImlkIjoiMDE5ZjBlNTQtODEwMS03YWEyLTk1YjgtNTVjNmJhMjVkZGJjIiwicmlkIjoiMDIwY2U4ZDEtNDMxMi00ODEzLWI2YTktZTE5NmM2YjQ1YjJmIn0.8vq6XOtHQTdPr0QG3CDocreBqeE-HgxbCIWHkh61jRv7rfz8ByXaIlBciueVfL1_9I512IIboivuqIXkSECkBg',
})

const schema = `
-- Spa
CREATE TABLE IF NOT EXISTS Spa (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  phone TEXT,
  openTime TEXT DEFAULT '08:00',
  closeTime TEXT DEFAULT '22:00',
  botActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

-- Branch
CREATE TABLE IF NOT EXISTS Branch (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  spaId TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (spaId) REFERENCES Spa(id) ON DELETE CASCADE
);

-- Customer
CREATE TABLE IF NOT EXISTS Customer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  spaId TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (spaId) REFERENCES Spa(id) ON DELETE CASCADE
);

-- Service
CREATE TABLE IF NOT EXISTS Service (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  duration INTEGER,
  description TEXT,
  spaId TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (spaId) REFERENCES Spa(id) ON DELETE CASCADE
);

-- Booking
CREATE TABLE IF NOT EXISTS Booking (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  serviceId TEXT NOT NULL,
  branchId TEXT,
  spaId TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  bookingTime TEXT,
  note TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (customerId) REFERENCES Customer(id) ON DELETE CASCADE,
  FOREIGN KEY (serviceId) REFERENCES Service(id) ON DELETE CASCADE,
  FOREIGN KEY (branchId) REFERENCES Branch(id) ON DELETE SET NULL,
  FOREIGN KEY (spaId) REFERENCES Spa(id) ON DELETE CASCADE
);

-- ChatLog
CREATE TABLE IF NOT EXISTS ChatLog (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  spaId TEXT NOT NULL,
  branchId TEXT,
  sender TEXT DEFAULT 'user',
  content TEXT NOT NULL,
  sessionId TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (customerId) REFERENCES Customer(id) ON DELETE CASCADE,
  FOREIGN KEY (spaId) REFERENCES Spa(id) ON DELETE CASCADE,
  FOREIGN KEY (branchId) REFERENCES Branch(id) ON DELETE SET NULL
);

-- SpaConfig
CREATE TABLE IF NOT EXISTS SpaConfig (
  id TEXT PRIMARY KEY,
  spaId TEXT UNIQUE NOT NULL,
  botGreeting TEXT,
  botName TEXT DEFAULT 'CS Bot',
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (spaId) REFERENCES Spa(id) ON DELETE CASCADE
);
`

async function main() {
  console.log('Creating tables on Turso...')
  
  const statements = schema.split(';').filter(s => s.trim())
  for (const stmt of statements) {
    if (stmt.trim()) {
      try {
        await client.execute(stmt)
        console.log('✓ Table created:', stmt.substring(8, 50).trim().split(' ')[0])
      } catch (err: any) {
        if (!err.message?.includes('already exists')) {
          console.error('Error:', err.message)
        } else {
          console.log('○ Already exists:', stmt.substring(8, 50).trim().split(' ')[0])
        }
      }
    }
  }
  
  console.log('\nDone! Tables ready on Turso.')
}

main().catch(console.error).finally(() => process.exit())
