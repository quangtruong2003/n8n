import bcrypt from 'bcryptjs'
import { db } from '../db'

const T = 'tenant_demo_001'

function uuid(): string {
  return crypto.randomUUID()
}

function iso(daysAgo: number, hour: number, minute: number = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

async function seed() {
  console.log('=== Seeding sample data (002) ===')

  const staffHash = await bcrypt.hash('123456', 10)
  const stmts: Array<{ sql: string; args: unknown[] }> = []

  // ─── Staff accounts ────────────────────────────
  const staffUsers = [
    { id: 'user_staff_001', username: 'nguyen_van_a', name: 'Nguyễn Văn A', phone: '0911111111', role_id: 'role_manager' },
    { id: 'user_staff_002', username: 'tran_thi_b', name: 'Trần Thị B', phone: '0912222222', role_id: 'role_staff' },
    { id: 'user_staff_003', username: 'le_van_c', name: 'Lê Văn C', phone: '0913333333', role_id: 'role_staff' },
  ]
  for (const s of staffUsers) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO "User" (id, username, password_hash, role, tenant_id, full_name, phone, active) VALUES (?, ?, ?, 'staff', ?, ?, ?, 1)`,
      args: [s.id, s.username, staffHash, T, s.name, s.phone],
    })
    // Assign to branches
    stmts.push({ sql: `INSERT OR IGNORE INTO UserBranch (user_id, branch_id) VALUES (?, 'branch_001')`, args: [s.id] })
    if (s.role_id === 'role_manager') {
      stmts.push({ sql: `INSERT OR IGNORE INTO UserBranch (user_id, branch_id) VALUES (?, 'branch_002')`, args: [s.id] })
    }
  }

  // ─── Bookings (10 sample bookings) ─────────────
  const bookings = [
    { id: uuid(), cust: 'cust_001', branch: 'branch_001', staff: 'user_staff_001', status: 'completed', d: 3, h: 9, svc: 'svc_002', price: 350000 },
    { id: uuid(), cust: 'cust_002', branch: 'branch_001', staff: 'user_staff_002', status: 'completed', d: 2, h: 14, svc: 'svc_001', price: 200000 },
    { id: uuid(), cust: 'cust_003', branch: 'branch_002', staff: 'user_staff_001', status: 'completed', d: 2, h: 10, svc: 'svc_005', price: 150000 },
    { id: uuid(), cust: 'cust_004', branch: 'branch_003', staff: 'user_staff_003', status: 'completed', d: 1, h: 15, svc: 'svc_007', price: 250000 },
    { id: uuid(), cust: 'cust_005', branch: 'branch_001', staff: 'user_staff_002', status: 'confirmed', d: 0, h: 10, svc: 'svc_003', price: 250000 },
    { id: uuid(), cust: 'cust_006', branch: 'branch_001', staff: 'user_staff_001', status: 'pending', d: 0, h: 14, svc: 'svc_004', price: 450000 },
    { id: uuid(), cust: 'cust_007', branch: 'branch_002', staff: 'user_staff_002', status: 'pending', d: 0, h: 16, svc: 'svc_009', price: 800000 },
    { id: uuid(), cust: 'cust_008', branch: 'branch_003', staff: 'user_staff_003', status: 'cancelled', d: 4, h: 11, svc: 'svc_010', price: 150000 },
    { id: uuid(), cust: 'cust_001', branch: 'branch_002', staff: 'user_staff_001', status: 'confirmed', d: 0, h: 9, svc: 'svc_006', price: 120000 },
    { id: uuid(), cust: 'cust_003', branch: 'branch_001', staff: 'user_staff_002', status: 'completed', d: 1, h: 13, svc: 'svc_008', price: 180000 },
  ]

  let orderId1 = '', orderId2 = '', orderId3 = '', orderId4 = '', orderId10 = ''

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i]
    const start = iso(b.d, b.h)
    const end = iso(b.d, b.h + 1)
    let oid: string | null = null

    // Auto-create orders for completed bookings
    if (b.status === 'completed') {
      oid = uuid()
      const orderCode = `ORD-${10001 + i}`
      stmts.push({
        sql: `INSERT OR IGNORE INTO "Order" (id, tenant_id, branch_id, customer_id, user_id, order_code, status, payment_status, subtotal, discount, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', 'paid', ?, 0, ?, ?, ?)`,
        args: [oid, T, b.branch, b.cust, b.staff || 'user_owner_001', orderCode, b.price, b.price, iso(b.d, b.h + 1, 30), iso(b.d, b.h + 1, 30)],
      })
      stmts.push({
        sql: `INSERT OR IGNORE INTO OrderItem (id, order_id, product_id, quantity, unit_price, discount, total, created_at) VALUES (?, ?, ?, 1, ?, 0, ?, ?)`,
        args: [uuid(), oid, b.svc, b.price, b.price, iso(b.d, b.h, 5)],
      })
      stmts.push({
        sql: `INSERT OR IGNORE INTO Payment (id, order_id, tenant_id, amount, method, paid_at, created_by, created_at) VALUES (?, ?, ?, ?, 'cash', ?, ?, ?)`,
        args: [uuid(), oid, T, b.price, iso(b.d, b.h + 1, 30), b.staff || 'user_owner_001', iso(b.d, b.h + 1, 30)],
      })
      if (i === 0) orderId1 = oid
      if (i === 1) orderId2 = oid
      if (i === 2) orderId3 = oid
      if (i === 3) orderId4 = oid
      if (i === 9) orderId10 = oid
    }

    stmts.push({
      sql: `INSERT OR IGNORE INTO Booking (id, tenant_id, branch_id, customer_id, status, booking_start, booking_end, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [b.id, T, b.branch, b.cust, b.status, start, end, null, iso(b.d, 8), iso(b.d, 8)],
    })

    stmts.push({
      sql: `INSERT OR IGNORE INTO BookingItem (id, booking_id, product_id, staff_id, quantity, price) VALUES (?, ?, ?, ?, 1, ?)`,
      args: [uuid(), b.id, b.svc, b.staff, b.price],
    })
  }

  // ─── Standalone Orders (not from bookings) ─────
  const extraOrders = [
    { cust: 'cust_002', branch: 'branch_003', d: 3, h: 11, svc: 'svc_006', price: 120000, status: 'completed', pay: 'paid' },
    { cust: 'cust_004', branch: 'branch_001', d: 1, h: 16, svc: 'svc_002', price: 350000, status: 'completed', pay: 'partial' },
    { cust: 'cust_005', branch: 'branch_002', d: 0, h: 17, svc: 'svc_001', price: 200000, status: 'pending', pay: 'unpaid' },
  ]

  for (let i = 0; i < extraOrders.length; i++) {
    const o = extraOrders[i]
    const oid = uuid()
    const orderCode = `ORD-${20001 + i}`
    stmts.push({
      sql: `INSERT OR IGNORE INTO "Order" (id, tenant_id, branch_id, customer_id, user_id, order_code, status, payment_status, subtotal, discount, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      args: [oid, T, o.branch, o.cust, 'user_owner_001', orderCode, o.status, o.pay, o.price, o.price, iso(o.d, o.h), iso(o.d, o.h)],
    })
    stmts.push({
      sql: `INSERT OR IGNORE INTO OrderItem (id, order_id, product_id, quantity, unit_price, discount, total, created_at) VALUES (?, ?, ?, 1, ?, 0, ?, ?)`,
      args: [uuid(), oid, o.svc, o.price, o.price, iso(o.d, o.h, 5)],
    })
    if (o.pay !== 'unpaid') {
      stmts.push({
        sql: `INSERT OR IGNORE INTO Payment (id, order_id, tenant_id, amount, method, paid_at, created_by, created_at) VALUES (?, ?, ?, ?, 'cash', ?, ?, ?)`,
        args: [uuid(), oid, T, o.pay === 'paid' ? o.price : Math.floor(o.price / 2), iso(o.d, o.h, 30), 'user_owner_001', iso(o.d, o.h, 30)],
      })
    }
  }

  // ─── Chat Sessions (5 sample sessions) ─────────
  const chatSessions = [
    { id: uuid(), cust: 'cust_001', channel: 'web', status: 'active', msg: 'Xin chào, spa có dịch vụ massage body không ạ?' },
    { id: uuid(), cust: 'cust_002', channel: 'zalo', status: 'staff_handling', msg: 'Cho em hỏi giá gội đầu dưỡng sinh ạ' },
    { id: uuid(), cust: 'cust_003', channel: 'web', status: 'bot_handling', msg: 'Em muốn đặt lịch xông hơi' },
    { id: uuid(), cust: 'cust_004', channel: 'zalo', status: 'resolved', msg: 'Cảm ơn spa nha' },
    { id: uuid(), cust: 'cust_005', channel: 'web', status: 'active', msg: 'Triệt lông toàn thân bao nhiêu tiền?' },
  ]

  for (const cs of chatSessions) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO ChatSession (id, tenant_id, customer_id, channel, status, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [cs.id, T, cs.cust, cs.channel, cs.status, iso(0, 10), iso(0, 9), iso(0, 10)],
    })

    // Customer message
    stmts.push({
      sql: `INSERT OR IGNORE INTO ChatMessage (id, tenant_id, session_id, customer_id, sender, content, channel, created_at) VALUES (?, ?, ?, ?, 'customer', ?, ?, ?)`,
      args: [uuid(), T, cs.id, cs.cust, cs.msg, cs.channel, iso(0, 9)],
    })

    // Bot reply
    stmts.push({
      sql: `INSERT OR IGNORE INTO ChatMessage (id, tenant_id, session_id, customer_id, sender, content, channel, created_at) VALUES (?, ?, ?, ?, 'bot', ?, ?, ?)`,
      args: [uuid(), T, cs.id, cs.cust, 'Chào bạn! Cảm ơn bạn đã liên hệ. Mình sẽ hỗ trợ bạn ngay ạ.', cs.channel, iso(0, 9, 1)],
    })

    // Staff reply for staff_handling sessions
    if (cs.status === 'staff_handling') {
      stmts.push({
        sql: `INSERT OR IGNORE INTO ChatMessage (id, tenant_id, session_id, customer_id, sender, sender_id, content, channel, created_at) VALUES (?, ?, ?, ?, 'staff', 'user_staff_001', ?, ?, ?)`,
        args: [uuid(), T, cs.id, cs.cust, 'Chào bạn! Em là nhân viên tư vấn这边. Em hỗ trợ bạn nhé!', cs.channel, iso(0, 10)],
      })
    }
  }

  // ─── Customer Notes ────────────────────────────
  const notes = [
    { cust: 'cust_001', content: 'Khách quen, thích massage body 60 phút', staff: 'user_staff_001', d: 5 },
    { cust: 'cust_001', content: 'Dị ứng với tinh dầu tràm, cần lưu ý', staff: 'user_owner_001', d: 3 },
    { cust: 'cust_002', content: 'VIP, thường đặt lịch cuối tuần', staff: 'user_staff_002', d: 4 },
    { cust: 'cust_003', content: 'Mới, lần đầu đến spa', staff: 'user_staff_001', d: 2 },
    { cust: 'cust_005', content: 'Thích gội đầu dưỡng sinh, hay đặt buổi chiều', staff: 'user_owner_001', d: 1 },
  ]

  for (const n of notes) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO CustomerNote (id, customer_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [uuid(), n.cust, n.staff, n.content, iso(n.d, 14)],
    })
  }

  // ─── AuditLog (sample entries) ─────────────────
  const auditActions = [
    { action: 'login', entity_type: 'User', entity_id: 'user_owner_001', user_id: 'user_owner_001', d: 0, h: 8 },
    { action: 'create', entity_type: 'Booking', entity_id: 'booking', user_id: 'user_staff_001', d: 0, h: 9 },
    { action: 'create', entity_type: 'Order', entity_id: 'order', user_id: 'user_owner_001', d: 0, h: 11 },
    { action: 'update', entity_type: 'BotConfig', entity_id: 'botconfig_001', user_id: 'user_owner_001', d: 1, h: 15 },
    { action: 'update', entity_type: 'Booking', entity_id: 'booking', user_id: 'user_staff_001', d: 2, h: 10 },
  ]
  for (const a of auditActions) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO AuditLog (id, tenant_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [uuid(), T, a.user_id, a.action, a.entity_type, a.entity_id, iso(a.d, a.h)],
    })
  }

  // ─── Settings (tenant-specific) ────────────────
  const extraSettings = [
    { key: 'loyalty_points_per_vnd', value: '0.001', desc: 'Tích điểm' },
    { key: 'booking_deposit_percent', value: '30', desc: 'Đặt cọc trước 30%' },
  ]
  for (const s of extraSettings) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO Setting (id, tenant_id, key, value, description) VALUES (?, ?, ?, ?, ?)`,
      args: [uuid(), T, s.key, s.value, s.desc],
    })
  }

  // ─── Exec ──────────────────────────────────────
  console.log(`Executing ${stmts.length} statements...`)

  try {
    const batch = stmts.map(s => ({ sql: s.sql, args: s.args as Array<string | number | null> }))
    await db.batch(batch, 'write')
  } catch (err: any) {
    // Batch may fail on individual INSERT OR IGNORE — fall back to sequential
    console.log('Batch failed, running sequentially...')
    let ok = 0, skip = 0
    for (const s of stmts) {
      try {
        await db.execute(s.sql, s.args as Array<string | number | null>)
        ok++
      } catch {
        skip++
      }
    }
    console.log(`Sequential: ${ok} ok, ${skip} skipped`)
  }

  console.log('=== Sample data seeded ===')
  console.log(`Staff: ${staffUsers.length}`)
  console.log(`Bookings: ${bookings.length}`)
  console.log(`Orders: ${bookings.filter(b => b.status === 'completed').length + extraOrders.length}`)
  console.log(`ChatSessions: ${chatSessions.length}`)
  console.log(`CustomerNotes: ${notes.length}`)
  console.log(`AuditLogs: ${auditActions.length}`)
}

seed().catch(console.error).finally(() => process.exit())
