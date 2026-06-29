import { createClient } from '@libsql/client'

const client = createClient({
  url: 'libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODI2NTIwNzQsImlkIjoiMDE5ZjBlNTQtODEwMS03YWEyLTk1YjgtNTVjNmJhMjVkZGJjIiwicmlkIjoiMDIwY2U4ZDEtNDMxMi00ODEzLWI2YTktZTE5NmM2YjQ1YjJmIn0.8vq6XOtHQTdPr0QG3CDocreBqeE-HgxbCIWHkh61jRv7rfz8ByXaIlBciueVfL1_9I512IIboivuqIXkSECkBg',
})

async function checkSchema() {
  console.log('Checking actual schema...\n')
  
  const tables = ['Service', 'Branch', 'SpaConfig', 'Customer', 'Booking', 'ChatLog', 'Spa']
  
  for (const table of tables) {
    try {
      const result = await client.execute({
        sql: `SELECT * FROM ${table} LIMIT 1`,
        args: []
      })
      
      if (result.rows.length > 0) {
        console.log(`Table: ${table}`)
        console.log('Columns:', Object.keys(result.rows[0]))
        console.log('Sample row:', result.rows[0])
        console.log('')
      } else {
        // Get columns from empty result
        const info = await client.execute({
          sql: `PRAGMA table_info(${table})`,
          args: []
        })
        console.log(`Table: ${table} (empty)`)
        console.log('Columns:', info.rows.map(r => `${r.name} (${r.type})`).join(', '))
        console.log('')
      }
    } catch (err: any) {
      console.log(`Table: ${table} - ERROR: ${err.message}`)
      console.log('')
    }
  }
}

checkSchema().finally(() => process.exit())
