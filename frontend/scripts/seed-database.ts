/**
 * Database Seed Script
 * Run: npx tsx scripts/seed-database.ts
 */

import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.DATABASE_URL || 'libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const SPA_ID = 'spa_demo_001'

async function seed() {
  console.log('Starting database seed...\n')

  // 1. Create/Update Spa
  await client.execute({
    sql: `INSERT OR REPLACE INTO Spa (id, name, pin, phone, openTime, closeTime, botActive) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [SPA_ID, 'Spa Quang Truong Demo', '1234', '0909123456', '08:00', '22:00', 1]
  })
  console.log('✓ Spa created/updated')

  // 2. Create SpaConfig
  await client.execute({
    sql: `INSERT OR REPLACE INTO SpaConfig (id, spaId, botGreeting, botName) VALUES (?, ?, ?, ?)`,
    args: ['config_001', SPA_ID, 'Xin chào! Em là lễ tân ảo của Spa Quang Truong. Em có thể giúp gì cho anh/chị?', 'Bot Lễ Tân']
  })
  console.log('✓ SpaConfig created/updated')

  // 3. Create Branches
  const branches = [
    { id: 'branch_001', name: 'Chi nhánh Quận 1', address: '123 Nguyễn Huệ, Q.1, TP.HCM' },
    { id: 'branch_002', name: 'Chi nhánh Quận 3', address: '456 Võ Văn Tần, Q.3, TP.HCM' },
    { id: 'branch_003', name: 'Chi nhánh Thủ Đức', address: '789 Xa lộ Hà Nội, TP. Thủ Đức' },
  ]

  for (const b of branches) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO Branch (id, name, address, spaId) VALUES (?, ?, ?, ?)`,
      args: [b.id, b.name, b.address, SPA_ID]
    })
  }
  console.log(`✓ ${branches.length} Branches created/updated`)

  // 4. Create Services
  const services = [
    { id: 'svc_001', name: 'Massage body toàn thân', price: 350000, duration: 60, desc: 'Massage body toàn thân 60 phút với tinh dầu thư giãn' },
    { id: 'svc_002', name: 'Massage cổ vai gáy', price: 200000, duration: 45, desc: 'Massage cổ vai gáy 45 phút giảm căng thẳng' },
    { id: 'svc_003', name: 'Massage chân', price: 200000, duration: 45, desc: 'Massage chân 45 phút thư giãn' },
    { id: 'svc_004', name: 'Facial chăm sóc da', price: 450000, duration: 90, desc: 'Facial chăm sóc da mặt nâng cao' },
    { id: 'svc_005', name: 'Gội đầu dưỡng sinh', price: 150000, duration: 30, desc: 'Gội đầu dưỡng sinh với thảo mộc' },
    { id: 'svc_006', name: 'Làm nail cơ bản', price: 120000, duration: 30, desc: 'Làm nail cơ bản sơn thường' },
    { id: 'svc_007', name: 'Làm nail thiết kế', price: 250000, duration: 60, desc: 'Làm nail thiết kế vẽ móng nghệ thuật' },
    { id: 'svc_008', name: 'Triệt lông vùng mặt', price: 180000, duration: 20, desc: 'Triệt lông vùng mặt công nghệ cao' },
    { id: 'svc_009', name: 'Triệt lông toàn thân', price: 800000, duration: 90, desc: 'Triệt lông toàn thân combo' },
    { id: 'svc_010', name: 'Xông hơi thảo mộc', price: 150000, duration: 30, desc: 'Xông hơi thảo mộc thư giãn' },
    { id: 'svc_011', name: 'Combo VIP massage + facial', price: 700000, duration: 120, desc: 'Combo massage body + facial trọn gói' },
  ]

  for (const s of services) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO Service (id, name, price, duration, description, spaId, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [s.id, s.name, s.price, s.duration, s.desc, SPA_ID]
    })
  }
  console.log(`✓ ${services.length} Services created/updated`)

  // 5. Create Customers with real data (masked names)
  const customers = [
    { id: 'cust_001', name: 'Nguyễn Thị Mai', phone: '0901111222' },
    { id: 'cust_002', name: 'Trần Văn Hùng', phone: '0902222333' },
    { id: 'cust_003', name: 'Lê Thị Hương', phone: '0903333444' },
    { id: 'cust_004', name: 'Phạm Minh Tuấn', phone: '0904444555' },
    { id: 'cust_005', name: 'Hoàng Thị Lan', phone: '0905555666' },
    { id: 'cust_006', name: 'Vũ Đức Anh', phone: '0906666777' },
    { id: 'cust_007', name: 'Đỗ Thị Ngọc', phone: '0907777888' },
    { id: 'cust_008', name: 'Bùi Văn Thành', phone: '0908888999' },
    { id: 'cust_009', name: 'Ngô Thị Hoa', phone: '0909999000' },
    { id: 'cust_010', name: 'Lý Minh Khôi', phone: '0911111222' },
  ]

  for (const c of customers) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO Customer (id, name, phone, spaId) VALUES (?, ?, ?, ?)`,
      args: [c.id, c.name, c.phone, SPA_ID]
    })
  }
  console.log(`✓ ${customers.length} Customers created/updated`)

  // 6. Create Bookings
  const now = new Date()
  const bookings = [
    { custId: 'cust_001', svcId: 'svc_001', branchId: 'branch_001', status: 'pending', offset: 3600000, note: 'Khách VIP' },
    { custId: 'cust_002', svcId: 'svc_004', branchId: 'branch_001', status: 'pending', offset: 7200000, note: null },
    { custId: 'cust_003', svcId: 'svc_002', branchId: 'branch_002', status: 'pending', offset: 5400000, note: 'Yêu cầu phòng riêng' },
    { custId: 'cust_004', svcId: 'svc_005', branchId: 'branch_002', status: 'confirmed', offset: 1800000, note: null },
    { custId: 'cust_005', svcId: 'svc_003', branchId: 'branch_001', status: 'confirmed', offset: -3600000, note: null },
    { custId: 'cust_006', svcId: 'svc_006', branchId: 'branch_003', status: 'cancelled', offset: -43200000, note: 'Khách bận hẹn lại' },
    { custId: 'cust_007', svcId: 'svc_011', branchId: 'branch_001', status: 'completed', offset: -86400000, note: null },
    { custId: 'cust_008', svcId: 'svc_001', branchId: 'branch_002', status: 'completed', offset: -172800000, note: null },
  ]

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i]
    const bookingTime = new Date(now.getTime() + b.offset).toISOString()
    await client.execute({
      sql: `INSERT OR REPLACE INTO Booking (id, customerId, serviceId, branchId, spaId, status, bookingTime, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [`book_${String(i + 1).padStart(3, '0')}`, b.custId, b.svcId, b.branchId, SPA_ID, b.status, bookingTime, b.note]
    })
  }
  console.log(`✓ ${bookings.length} Bookings created/updated`)

  // 7. Create Chat Logs
  const chatLogs = [
    { custId: 'cust_001', sender: 'user', content: 'Xin chào, mình muốn đặt lịch massage body', branchId: 'branch_001', sessionId: 'sess_001' },
    { custId: 'cust_001', sender: 'bot', content: 'Xin chào! Massage body toàn thân bên mình giá 350.000đ cho 60 phút. Bạn muốn đặt lịch giờ nào ạ?', branchId: 'branch_001', sessionId: 'sess_001' },
    { custId: 'cust_001', sender: 'user', content: 'Mình muốn đặt 2 giờ chiều mai tại chi nhánh Q1', branchId: 'branch_001', sessionId: 'sess_001' },
    { custId: 'cust_001', sender: 'bot', content: 'Dạ đã ghi nhận! Đặt massage body toàn thân lúc 14:00 ngày mai tại chi nhánh Q1. Bạn có yêu cầu gì thêm không ạ?', branchId: 'branch_001', sessionId: 'sess_001' },
    { custId: 'cust_002', sender: 'user', content: 'Cho mình hỏi giá facial bao nhiêu?', branchId: 'branch_001', sessionId: 'sess_002' },
    { custId: 'cust_002', sender: 'bot', content: 'Dạ, facial chăm sóc da bên mình giá 450.000đ cho 90 phút ạ. Bạn muốn đặt lịch không?', branchId: 'branch_001', sessionId: 'sess_002' },
    { custId: 'cust_003', sender: 'user', content: 'Spa có triệt lông không? Giá bao nhiêu?', branchId: 'branch_002', sessionId: 'sess_003' },
    { custId: 'cust_003', sender: 'bot', content: 'Dạ có! Triệt lông vùng mặt 180.000đ (20 phút) hoặc triệt lông toàn thân 800.000đ (90 phút) ạ.', branchId: 'branch_002', sessionId: 'sess_003' },
    { custId: 'cust_004', sender: 'user', content: 'Mình muốn đặt gội đầu dưỡng sinh 3 giờ chiều nay', branchId: 'branch_002', sessionId: 'sess_004' },
    { custId: 'cust_004', sender: 'bot', content: 'Dạ đã đặt lịch thành công! Gội đầu dưỡng sinh lúc 15:00 hôm nay tại chi nhánh Q3. Cảm ơn bạn!', branchId: 'branch_002', sessionId: 'sess_004' },
    { custId: 'cust_005', sender: 'user', content: 'Hủy lịch đặt massage hôm qua được không?', branchId: 'branch_001', sessionId: 'sess_005' },
    { custId: 'cust_005', sender: 'bot', content: 'Dạ được ạ. Để mình kiểm tra... Lịch massage body lúc 14:00 hôm qua tại Q1 đã được hủy. Cảm ơn bạn!', branchId: 'branch_001', sessionId: 'sess_005' },
  ]

  for (let i = 0; i < chatLogs.length; i++) {
    const l = chatLogs[i]
    const createdAt = new Date(now.getTime() - (chatLogs.length - i) * 60000).toISOString()
    await client.execute({
      sql: `INSERT OR REPLACE INTO ChatLog (id, customerId, spaId, branchId, sender, content, sessionId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [`log_${String(i + 1).padStart(3, '0')}`, l.custId, SPA_ID, l.branchId, l.sender, l.content, l.sessionId, createdAt]
    })
  }
  console.log(`✓ ${chatLogs.length} ChatLogs created/updated`)

  console.log('\n✅ Database seeded successfully!')
  console.log('\nLogin credentials:')
  console.log('  PIN: 1234')
  console.log(`  Spa ID: ${SPA_ID}`)
}

seed().catch(console.error).finally(() => process.exit())
