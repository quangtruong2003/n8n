import bcrypt from 'bcryptjs'
import { db } from '../db'

const TENANT_ID = 'tenant_demo_001'

async function seed() {
  console.log('=== Seeding universal database ===')

  // Pre-hash passwords
  const adminHash = await bcrypt.hash('admin', 10)
  const ownerHash = await bcrypt.hash('password', 10)

  const statements: Array<{ sql: string; args: unknown[] }> = []

  // ──────────────────────────────────────────────
  // 1. Super Admin (tenant_id = NULL)
  // ──────────────────────────────────────────────
  statements.push({
    sql: `INSERT OR IGNORE INTO User (id, username, password_hash, role, tenant_id, full_name, active)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: ['admin_001', 'admin', adminHash, 'super_admin', null, 'Super Admin', 1],
  })

  // ──────────────────────────────────────────────
  // 2. Demo Tenant
  // ──────────────────────────────────────────────
  statements.push({
    sql: `INSERT OR IGNORE INTO Tenant (id, name, slug, business_type, open_time, close_time, active)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [TENANT_ID, 'Spa Quang Truong Demo', 'spa-quang-truong', 'spa', '08:00', '22:00', 1],
  })

  // ──────────────────────────────────────────────
  // 3. Demo Owner
  // ──────────────────────────────────────────────
  statements.push({
    sql: `INSERT OR IGNORE INTO User (id, username, password_hash, role, tenant_id, full_name, phone, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['user_owner_001', 'owner_demo', ownerHash, 'owner', TENANT_ID, 'Owner Demo', '0909123456', 1],
  })

  // ──────────────────────────────────────────────
  // 4. Branches
  // ──────────────────────────────────────────────
  const branches = [
    { id: 'branch_001', name: 'Chi nhánh Q1', address: '123 Nguyễn Huệ, Q.1, HCM', is_main: 1 },
    { id: 'branch_002', name: 'Chi nhánh Q3', address: '456 Võ Văn Tần, Q.3, HCM', is_main: 0 },
    { id: 'branch_003', name: 'Chi nhánh Thủ Đức', address: '789 Xa lộ Hà Nội, TP. Thủ Đức', is_main: 0 },
  ]

  for (const b of branches) {
    statements.push({
      sql: `INSERT OR IGNORE INTO Branch (id, tenant_id, name, address, is_main, active)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [b.id, TENANT_ID, b.name, b.address, b.is_main, 1],
    })
  }

  // ──────────────────────────────────────────────
  // 5. Roles + Permissions
  // ──────────────────────────────────────────────
  statements.push({
    sql: `INSERT OR IGNORE INTO Role (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`,
    args: ['role_manager', TENANT_ID, 'Quản lý', 'Toàn quyền quản lý'],
  })
  statements.push({
    sql: `INSERT OR IGNORE INTO Role (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`,
    args: ['role_staff', TENANT_ID, 'Nhân viên', 'Quyền hạn chế'],
  })

  // Manager: full CRUD on all resources
  const managerResources = ['booking', 'order', 'customer', 'product', 'branch', 'report']
  for (const resource of managerResources) {
    statements.push({
      sql: `INSERT OR IGNORE INTO Permission (id, role_id, resource, can_view, can_create, can_edit, can_delete)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [`perm_mgr_${resource}`, 'role_manager', resource, 1, 1, 1, 1],
    })
  }

  // Staff: limited permissions
  const staffPerms: Array<{ resource: string; v: number; c: number; e: number; d: number }> = [
    { resource: 'booking', v: 1, c: 1, e: 1, d: 0 },
    { resource: 'order', v: 1, c: 1, e: 0, d: 0 },
    { resource: 'customer', v: 1, c: 0, e: 0, d: 0 },
    { resource: 'product', v: 1, c: 0, e: 0, d: 0 },
  ]
  for (const p of staffPerms) {
    statements.push({
      sql: `INSERT OR IGNORE INTO Permission (id, role_id, resource, can_view, can_create, can_edit, can_delete)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [`perm_staff_${p.resource}`, 'role_staff', p.resource, p.v, p.c, p.e, p.d],
    })
  }

  // ──────────────────────────────────────────────
  // 6. ProductCategories (hierarchical)
  // ──────────────────────────────────────────────
  const categories = [
    // Parent categories
    { id: 'cat_massage', parent_id: null, name: 'Massage', sort_order: 1 },
    { id: 'cat_skincare', parent_id: null, name: 'Chăm sóc da', sort_order: 2 },
    { id: 'cat_relax', parent_id: null, name: 'Thư giãn', sort_order: 3 },
    { id: 'cat_nail', parent_id: null, name: 'Làm nail', sort_order: 4 },
    { id: 'cat_hair_removal', parent_id: null, name: 'Triệt lông', sort_order: 5 },
    // Child categories
    { id: 'cat_massage_body', parent_id: 'cat_massage', name: 'Massage Body', sort_order: 1 },
    { id: 'cat_massage_face', parent_id: 'cat_massage', name: 'Massage Mặt', sort_order: 2 },
    { id: 'cat_skincare_basic', parent_id: 'cat_skincare', name: 'Da mặt cơ bản', sort_order: 1 },
    { id: 'cat_skincare_adv', parent_id: 'cat_skincare', name: 'Da mặt nâng cao', sort_order: 2 },
    { id: 'cat_relax_hair', parent_id: 'cat_relax', name: 'Gội đầu', sort_order: 1 },
    { id: 'cat_relax_steam', parent_id: 'cat_relax', name: 'Xông hơi', sort_order: 2 },
    { id: 'cat_nail_basic', parent_id: 'cat_nail', name: 'Nail cơ bản', sort_order: 1 },
    { id: 'cat_nail_design', parent_id: 'cat_nail', name: 'Nail thiết kế', sort_order: 2 },
  ]

  for (const cat of categories) {
    statements.push({
      sql: `INSERT OR IGNORE INTO ProductCategory (id, tenant_id, parent_id, name, sort_order, active)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [cat.id, TENANT_ID, cat.parent_id, cat.name, cat.sort_order, 1],
    })
  }

  // ──────────────────────────────────────────────
  // 7. Products (from old seed.ts, type='service')
  // ──────────────────────────────────────────────
  const products = [
    { id: 'svc_001', cat: 'cat_massage_body', name: 'Massage cổ vai gáy', price: 200000, duration: 45, desc: 'Massage cổ vai gáy 45 phút' },
    { id: 'svc_002', cat: 'cat_massage_body', name: 'Massage body toàn thân', price: 350000, duration: 60, desc: 'Massage toàn thân 60 phút' },
    { id: 'svc_003', cat: 'cat_skincare_basic', name: 'Chăm sóc da mặt cơ bản', price: 250000, duration: 45, desc: 'Chăm sóc da mặt cơ bản' },
    { id: 'svc_004', cat: 'cat_skincare_adv', name: 'Chăm sóc da mặt nâng cao', price: 450000, duration: 60, desc: 'Chăm sóc da mặt nâng cao' },
    { id: 'svc_005', cat: 'cat_relax_hair', name: 'Gội đầu dưỡng sinh', price: 150000, duration: 30, desc: 'Gội đầu dưỡng sinh' },
    { id: 'svc_006', cat: 'cat_nail_basic', name: 'Làm nail cơ bản', price: 120000, duration: 30, desc: 'Làm nail cơ bản' },
    { id: 'svc_007', cat: 'cat_nail_design', name: 'Làm nail thiết kế', price: 250000, duration: 60, desc: 'Làm nail thiết kế' },
    { id: 'svc_008', cat: 'cat_hair_removal', name: 'Triệt lông vùng mặt', price: 180000, duration: 20, desc: 'Triệt lông vùng mặt' },
    { id: 'svc_009', cat: 'cat_hair_removal', name: 'Triệt lông toàn thân', price: 800000, duration: 90, desc: 'Triệt lông toàn thân' },
    { id: 'svc_010', cat: 'cat_relax_steam', name: 'Xông hơi thảo mộc', price: 150000, duration: 30, desc: 'Xông hơi thảo mộc' },
  ]

  for (const p of products) {
    statements.push({
      sql: `INSERT OR IGNORE INTO Product (id, tenant_id, category_id, name, type, description, price, duration_minutes, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [p.id, TENANT_ID, p.cat, p.name, 'service', p.desc, p.price, p.duration, 1],
    })
  }

  // ──────────────────────────────────────────────
  // 8. Customers (from old seed.ts)
  // ──────────────────────────────────────────────
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
    statements.push({
      sql: `INSERT OR IGNORE INTO Customer (id, tenant_id, name, phone, active)
            VALUES (?, ?, ?, ?, ?)`,
      args: [c.id, TENANT_ID, c.name, c.phone, 1],
    })
  }

  // ──────────────────────────────────────────────
  // 9. BotConfig
  // ──────────────────────────────────────────────
  statements.push({
    sql: `INSERT OR IGNORE INTO BotConfig (id, tenant_id, bot_name, greeting, ai_enabled, ai_model, channels)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'botconfig_001',
      TENANT_ID,
      'Trợ lý ảo',
      'Xin chào! Em là lễ tân ảo của Spa Quang Truong. Em có thể giúp gì cho anh/chị?',
      1,
      'openai/gpt-4o-mini',
      '["web"]',
    ],
  })

  // ──────────────────────────────────────────────
  // 10. Settings
  // ──────────────────────────────────────────────
  // Global settings (tenant_id = null)
  const globalSettings: Array<{ key: string; value: string; desc: string }> = [
    { key: 'app_name', value: 'GHOST-WORKER', desc: 'Application name' },
    { key: 'app_version', value: '0.2.0', desc: 'Application version' },
  ]

  for (const s of globalSettings) {
    statements.push({
      sql: `INSERT OR IGNORE INTO Setting (id, tenant_id, key, value, description)
            VALUES (?, ?, ?, ?, ?)`,
      args: [`setting_global_${s.key}`, null, s.key, s.value, s.desc],
    })
  }

  // Tenant settings
  const tenantSettings: Array<{ key: string; value: string; desc: string }> = [
    { key: 'tax_rate', value: '0.1', desc: 'Default tax rate (10%)' },
    { key: 'currency', value: 'VND', desc: 'Currency code' },
  ]

  for (const s of tenantSettings) {
    statements.push({
      sql: `INSERT OR IGNORE INTO Setting (id, tenant_id, key, value, description)
            VALUES (?, ?, ?, ?, ?)`,
      args: [`setting_tenant_${s.key}`, TENANT_ID, s.key, s.value, s.desc],
    })
  }

  // ──────────────────────────────────────────────
  // 11. UserBranch (link owner to all branches)
  // ──────────────────────────────────────────────
  for (const b of branches) {
    statements.push({
      sql: `INSERT OR IGNORE INTO UserBranch (user_id, branch_id) VALUES (?, ?)`,
      args: ['user_owner_001', b.id],
    })
  }

  // ──────────────────────────────────────────────
  // Execute all in a batch (transactional)
  // ──────────────────────────────────────────────
  console.log(`Executing ${statements.length} seed statements...`)

  const batch = statements.map((s) => ({
    sql: s.sql,
    args: s.args as Array<string | number | null>,
  }))

  await db.batch(batch, 'write')

  console.log('=== Seed completed ===')
  console.log(`Tenant: ${TENANT_ID}`)
  console.log('Super Admin: admin / admin')
  console.log('Owner: owner_demo / password')
  console.log(`Tables seeded: User(3), Tenant(1), Branch(3), Role(2), Permission(10), ProductCategory(13), Product(10), Customer(8), BotConfig(1), Setting(4), UserBranch(3)`)
}

seed().catch(console.error).finally(() => process.exit())
