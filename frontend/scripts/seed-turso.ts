import { createClient } from '@libsql/client'

const client = createClient({
  url: 'libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODI2NTIwNzQsImlkIjoiMDE5ZjBlNTQtODEwMS03YWEyLTk1YjgtNTVjNmJhMjVkZGJjIiwicmlkIjoiMDIwY2U4ZDEtNDMxMi00ODEzLWI2YTktZTE5NmM2YjQ1YjJmIn0.8vq6XOtHQTdPr0QG3CDocreBqeE-HgxbCIWHkh61jRv7rfz8ByXaIlBciueVfL1_9I512IIboivuqIXkSECkBg',
})

const spaId = 'spa_demo_001'

async function seed() {
  console.log('Seeding demo data...')
  
  // Create Spa
  await client.execute({
    sql: `INSERT OR IGNORE INTO Spa (id, name, pin, phone, openTime, closeTime, botActive) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [spaId, 'Spa Quang Truong Demo', '1234', '0909123456', '08:00', '22:00', 1]
  })
  console.log('✓ Spa created')
  
  // Create Branch
  await client.execute({
    sql: `INSERT OR IGNORE INTO Branch (id, name, address, spaId) VALUES (?, ?, ?, ?)`,
    args: ['branch_001', 'Chi nhánh 1', '123 Nguyễn Trãi, Q1, HCM', spaId]
  })
  console.log('✓ Branch created')
  
  // Create Services
  const services = [
    { id: 'svc_001', name: 'Massage Body', price: 350000, duration: 60, desc: 'Massage toàn thân 60 phút' },
    { id: 'svc_002', name: 'Massage Foot', price: 200000, duration: 45, desc: 'Massage chân 45 phút' },
    { id: 'svc_003', name: 'Facial', price: 450000, duration: 90, desc: 'Chăm sóc da mặt 90 phút' },
    { id: 'svc_004', name: 'Combo VIP', price: 800000, duration: 120, desc: 'Combo massage + facial' },
  ]
  
  for (const s of services) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO Service (id, name, price, duration, description, spaId) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [s.id, s.name, s.price, s.duration, s.desc, spaId]
    })
  }
  console.log('✓ Services created')
  
  // Create Config
  await client.execute({
    sql: `INSERT OR IGNORE INTO SpaConfig (id, spaId, botGreeting, botName) VALUES (?, ?, ?, ?)`,
    args: ['config_001', spaId, 'Xin chào! Em là lễ tân ảo của Spa Quang Truong. Em có thể giúp gì cho anh/chị?', 'Bot Lễ Tân']
  })
  console.log('✓ Config created')
  
  console.log('\n✅ Demo data ready!')
  console.log(`Spa ID: ${spaId}`)
  console.log('Pin: 1234')
}

seed().catch(console.error).finally(() => process.exit())
