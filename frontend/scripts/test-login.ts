import { createClient } from '@libsql/client'

const client = createClient({
  url: 'libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODI2NTIwNzQsImlkIjoiMDE5ZjBlNTQtODEwMS03YWEyLTk1YjgtNTVjNmJhMjVkZGJjIiwicmlkIjoiMDIwY2U4ZDEtNDMxMi00ODEzLWI2YTktZTE5NmM2YjQ1YjJmIn0.8vq6XOtHQTdPr0QG3CDocreBqeE-HgxbCIWHkh61jRv7rfz8ByXaIlBciueVfL1_9I512IIboivuqIXkSECkBg',
})

async function test() {
  console.log('Testing login logic...\n')
  
  const pin = '1234'
  
  // Get spa
  const result = await client.execute({
    sql: `SELECT id, name, pin FROM Spa`,
    args: []
  })
  
  console.log('Spa result:', result.rows)
  
  if (result.rows.length > 0) {
    const spa = result.rows[0]
    console.log('Stored pin:', spa.pin)
    console.log('Input pin:', pin)
    console.log('Match:', spa.pin === pin)
  }
}

test().finally(() => process.exit())
