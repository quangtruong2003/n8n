import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.DATABASE_URL || 'libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function seed() {
  console.log('Seeding database...')

  const spaId = 'spa_demo_001'

  // Create Spa
  await db.execute({
    sql: `INSERT OR REPLACE INTO Spa (id, name, pin, phone, open_time, close_time, bot_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [spaId, 'Spa Quang Truong Demo', '1234', '0909123456', '08:00', '22:00', 1]
  })
  console.log('✓ Spa created')

  // Create Branches
  const branches = [
    { id: 'branch_001', name: 'Chi nhánh Q1', address: '123 Nguyễn Huệ, Q.1, HCM' },
    { id: 'branch_002', name: 'Chi nhánh Q3', address: '456 Võ Văn Tần, Q.3, HCM' },
    { id: 'branch_003', name: 'Chi nhánh Thủ Đức', address: '789 Xa lộ Hà Nội, TP. Thủ Đức' },
  ]

  for (const b of branches) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO Branch (id, name, address, spa_id) VALUES (?, ?, ?, ?)`,
      args: [b.id, b.name, b.address, spaId]
    })
  }
  console.log('✓ Branches created')

  // Create Services
  const services = [
    { id: 'svc_001', name: 'Massage cổ vai gáy', price: 200000, duration: 45, desc: 'Massage cổ vai gáy 45 phút' },
    { id: 'svc_002', name: 'Massage body toàn thân', price: 350000, duration: 60, desc: 'Massage toàn thân 60 phút' },
    { id: 'svc_003', name: 'Chăm sóc da mặt cơ bản', price: 250000, duration: 45, desc: 'Chăm sóc da mặt cơ bản' },
    { id: 'svc_004', name: 'Chăm sóc da mặt nâng cao', price: 450000, duration: 60, desc: 'Chăm sóc da mặt nâng cao' },
    { id: 'svc_005', name: 'Gội đầu dưỡng sinh', price: 150000, duration: 30, desc: 'Gội đầu dưỡng sinh' },
    { id: 'svc_006', name: 'Làm nail cơ bản', price: 120000, duration: 30, desc: 'Làm nail cơ bản' },
    { id: 'svc_007', name: 'Làm nail thiết kế', price: 250000, duration: 60, desc: 'Làm nail thiết kế' },
    { id: 'svc_008', name: 'Triệt lông vùng mặt', price: 180000, duration: 20, desc: 'Triệt lông vùng mặt' },
    { id: 'svc_009', name: 'Triệt lông toàn thân', price: 800000, duration: 90, desc: 'Triệt lông toàn thân' },
    { id: 'svc_010', name: 'Xông hơi thảo mộc', price: 150000, duration: 30, desc: 'Xông hơi thảo mộc' },
  ]

  for (const s of services) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO Service (id, name, price, duration, description, spa_id, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [s.id, s.name, s.price, s.duration, s.desc, spaId]
    })
  }
  console.log('✓ Services created')

  // Create Customers
  const customers = [
    { id: 'cust_001', name: 'Nguyễn Thị Mai', phone: '0901111222' },
    { id: 'cust_002', name: 'Trần Văn Hùng', phone: '0902222333' },
    { id: 'cust_003', name: 'Lê Thị Hương', phone: '0903333444' },
    { id: 'cust_004', name: 'Phạm Minh Tuấn', phone: '0904444555' },
    { id: 'cust_005', name: 'Hoàng Thị Lan', phone: '0905555666' },
    { id: 'cust_006', name: 'Vũ Đức Anh', phone: '0906666777' },
    { id: 'cust_007', name: 'Đỗ Thị Ngọc', phone: '0907777888' },
    { id: 'cust_008', name: 'Bùi Văn Thành', phone: '0908888999' },
  ]

  for (const c of customers) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO Customer (id, name, phone, spa_id) VALUES (?, ?, ?, ?)`,
      args: [c.id, c.name, c.phone, spaId]
    })
  }
  console.log('✓ Customers created')

  // Create Bookings
  const now = new Date()
  const bookings = [
    { custId: 'cust_001', svcId: 'svc_002', branchId: 'branch_001', status: 'pending', offset: 3600000, note: 'Dễ bị đau vai' },
    { custId: 'cust_002', svcId: 'svc_003', branchId: 'branch_001', status: 'pending', offset: 7200000, note: null },
    { custId: 'cust_003', svcId: 'svc_001', branchId: 'branch_002', status: 'pending', offset: 5400000, note: 'Khách VIP' },
    { custId: 'cust_004', svcId: 'svc_005', branchId: 'branch_002', status: 'confirmed', offset: 1800000, note: null },
    { custId: 'cust_005', svcId: 'svc_004', branchId: 'branch_001', status: 'completed', offset: -86400000, note: null },
    { custId: 'cust_006', svcId: 'svc_006', branchId: 'branch_003', status: 'cancelled', offset: -43200000, note: 'Khách bận' },
  ]

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i]
    const bookingTime = new Date(now.getTime() + b.offset).toISOString()
    await db.execute({
      sql: `INSERT OR REPLACE INTO Booking (id, customer_id, service_id, branch_id, spa_id, status, booking_time, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [`book_${i + 1}`, b.custId, b.svcId, b.branchId, spaId, b.status, bookingTime, b.note]
    })
  }
  console.log('✓ Bookings created')

  // Create Chat Logs
  const chatLogs = [
    { custId: 'cust_001', sender: 'user', content: 'Xin chào, mình muốn đặt lịch massage body', branchId: 'branch_001' },
    { custId: 'cust_001', sender: 'bot', content: 'Xin chào! Massage body toàn thân 350.000đ/60 phút. Bạn muốn đặt giờ nào ạ?', branchId: 'branch_001' },
    { custId: 'cust_001', sender: 'user', content: 'Mình muốn đặt 2 giờ chiều mai', branchId: 'branch_001' },
    { custId: 'cust_002', sender: 'user', content: 'Cho mình hỏi giá làm nail', branchId: 'branch_002' },
    { custId: 'cust_002', sender: 'bot', content: 'Dạ, nail cơ bản 120.000đ, nail thiết kế 250.000đ ạ.', branchId: 'branch_002' },
    { custId: 'cust_003', sender: 'user', content: 'Spa có dịch vụ triệt lông không?', branchId: 'branch_003' },
    { custId: 'cust_003', sender: 'bot', content: 'Dạ có! Triệt lông vùng mặt 180.000đ, toàn thân 800.000đ ạ.', branchId: 'branch_003' },
  ]

  for (let i = 0; i < chatLogs.length; i++) {
    const l = chatLogs[i]
    await db.execute({
      sql: `INSERT OR REPLACE INTO ChatLog (id, customer_id, spa_id, branch_id, sender, content, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [`log_${i + 1}`, l.custId, spaId, l.branchId, l.sender, l.content, `sess_${l.custId}`]
    })
  }
  console.log('✓ Chat logs created')

  // Create Config
  await db.execute({
    sql: `INSERT OR REPLACE INTO SpaConfig (id, spa_id, bot_greeting, bot_name) VALUES (?, ?, ?, ?)`,
    args: ['config_001', spaId, 'Xin chào! Em là lễ tân ảo của Spa Quang Truong. Em có thể giúp gì cho anh/chị?', 'Bot Lễ Tân']
  })
  console.log('✓ Config created')

  console.log('\n✅ Seed completed!')
  console.log(`Spa ID: ${spaId}`)
  console.log(`PIN: 1234`)
}

seed().catch(console.error).finally(() => process.exit())
