# Plan A: Database & Backend Core

> **Spec:** `docs/superpowers/specs/2026-06-28-universal-database-design.md`
> **Scope:** Migration DB → 23 bảng mới, Auth system, CRUD APIs, Seed data
> **Stack:** Next.js 16 + Turso (libsql) + bcrypt + JWT
> **Exclude:** Chatbot/Zalo (→ xem Plan B)

---

## Phase 0: Cleanup & Preparation

### Task 0.1 — Xác định哪些 file sẽ保留,哪些 sẽ xóa

**Giữ lại (refactor):**
- `frontend/src/lib/db.ts` — Turso client (giữ nguyên)
- `frontend/src/lib/token.ts` — refactor thành JWT chuẩn
- `frontend/src/app/api/auth/login/route.ts` — refactor cho username/password
- `frontend/src/app/api/auth/me/route.ts` — refactor cho user model
- `frontend/package.json` — thêm dependencies mới

**Xoá (thay thế bằng hệ thống mới):**
- `frontend/src/app/api/spa/[id]/*` — tất cả routes spa-scoped (sẽ rewrite theo tenant model mới)
- `frontend/src/app/api/n8n/route.ts` — không cần n8n bridge nữa

**Giữ nguyên (không đụng):**
- `frontend/src/app/dashboard/*` — UI (sẽ update sau)
- `frontend/prisma/*` — Prisma config (không dùng nhưng không xoá)
- `n8n/*` — giữ nguyên cho đến khi Plan B hoàn thành

### Task 0.2 — Install dependencies mới

```bash
cd frontend
npm install uuid          # UUID generation
npm install --save-dev @types/uuid
```

**Xem xét bỏ:**
- `next-auth` — installed nhưng không dùng, có thể xoá sau

---

## Phase 1: Database Schema Migration

### Task 1.1 — Tạo file SQL migration mới

**File:** `frontend/src/lib/migrations/001_universal_schema.sql`

Chứa toàn bộ 23 CREATE TABLE từ spec (Section 3), bao gồm:

**Auth layer (4 bảng):**
- `User` — super_admin, owner, staff
- `Session` — JWT session management
- `Role` — vai trò per tenant
- `Permission` — quyền hạn per role

**Organization layer (3 bảng):**
- `Tenant` — doanh nghiệp
- `Branch` — chi nhánh
- `UserBranch` — gán nhân viên vào chi nhánh

**Product layer (3 bảng):**
- `ProductCategory` — danh mục (hỗ trợ cây 3 cấp)
- `Product` — sản phẩm/dịch vụ/combo
- `ComboItem` — chi tiết combo

**Customer layer (2 bảng):**
- `Customer` — khách hàng
- `CustomerNote` — ghi chú

**Order layer (3 bảng):**
- `Order` — đơn hàng (double-quote vì ORDER là SQL keyword)
- `OrderItem` — chi tiết đơn
- `Payment` — thanh toán

**Booking layer (2 bảng):**
- `Booking` — lịch hẹn
- `BookingItem` — dịch vụ trong booking

**Chat layer (3 bảng):**
- `BotConfig` — cấu hình bot per tenant
- `ChatSession` — phiên chat
- `ChatMessage` — tin nhắn

**System layer (3 bảng):**
- `Attachment` — file đính kèm
- `AuditLog` — nhật ký thay đổi
- `Setting` — cấu hình key-value

**Verify:** Chạy SQL trên Turso local dev, kiểm tra 23 bảng tạo thành công.

### Task 1.2 — Tạo migration runner

**File:** `frontend/src/lib/migrate.ts`

- Đọc file SQL migration
- Execute trên Turso
- Log kết quả mỗi bảng
- Idempotent: dùng `CREATE TABLE IF NOT EXISTS`

**Verify:** `npx tsx src/lib/migrate.ts` chạy thành công, 23 bảng tồn tại.

### Task 1.3 — Tạo seed data

**File:** `frontend/src/lib/seeds/001_seed.ts`

Seed data bao gồm:

```
1. Super Admin
   - id: "admin_001"
   - username: "admin"
   - password: hash("admin") bằng bcrypt
   - role: "super_admin"
   - tenant_id: NULL

2. Demo Tenant
   - id: "tenant_demo_001"
   - name: "Spa Quang Truong Demo"
   - slug: "spa-quang-truong"
   - business_type: "spa"
   - open_time: "08:00", close_time: "22:00"

3. Demo Owner
   - id: "user_owner_001"
   - username: "owner_demo"
   - password: hash("password")
   - role: "owner"
   - tenant_id: "tenant_demo_001"

4. Branches (từ seed.ts hiện tại)
   - branch_001: Chi nhánh Q1 (is_main=1)
   - branch_002: Chi nhánh Q3
   - branch_003: Chi nhánh Thủ Đức

5. Roles
   - "Quản lý" (full permission)
   - "Nhân viên" (limited permission)

6. ProductCategories
   - "Massage" → "Massage Body", "Massage Mặt"
   - "Chăm sóc da" → "Da mặt cơ bản", "Da mặt nâng cao"
   - "Thư giãn" → "Gội đầu", "Xông hơi"
   - "Làm nail" → "Nail cơ bản", "Nail thiết kế"
   - "Triệt lông"

7. Products (từ seed.ts hiện tại, type='service')
   - svc_001 → svc_010 (10 dịch vụ)

8. Customers (từ seed.ts hiện tại)
   - cust_001 → cust_008

9. BotConfig mặc định
   - bot_name: "Trợ lý ảo"
   - greeting: "Xin chào! Em là lễ tân ảo..."
   - ai_enabled: 1
   - ai_model: "openai/gpt-4o-mini"

10. Settings
    - Global: app_name, version
    - Tenant: tax_rate, currency
```

**Verify:** Chạy seed, kiểm tra dữ liệu đúng.

---

## Phase 2: Auth System (Rewrite)

### Task 2.1 — JWT helper mới

**File:** `frontend/src/lib/auth/jwt.ts`

Thay thế `frontend/src/lib/token.ts` hiện tại (custom HMAC).

**Implement:**
```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES = '24h'

export function signToken(payload: { userId: string; tenantId: string | null; role: string }): string
export function verifyToken(token: string): { userId: string; tenantId: string | null; role: string } | null
```

**Verify:** Unit test sign → verify round-trip.

### Task 2.2 — Password helper

**File:** `frontend/src/lib/auth/password.ts`

```typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, hash: string): Promise<boolean>
```

**Verify:** Unit test hash → verify round-trip.

### Task 2.3 — Auth middleware

**File:** `frontend/src/lib/auth/middleware.ts`

Wrapper function cho API routes:

```typescript
export function withAuth(
  handler: (req: NextRequest, ctx: { user: AuthUser }) => Promise<NextResponse>,
  options?: { requiredRole?: string[]; requiredPermission?: { resource: string; action: string } }
): (req: NextRequest) => Promise<NextResponse>
```

**Logic:**
1. Đọc token từ `Authorization: Bearer <token>` header hoặc `session_token` cookie
2. Verify JWT
3. Query User từ DB, kiểm tra `active = 1`
4. Nếu `requiredRole` → check role
5. Nếu `requiredPermission` → query Permission table, check quyền
6. Nếu pass → gọi handler với `{ user }`
7. Nếu fail → trả 401/403

**Verify:** Test với token hợp lệ, token hết hạn, token sai, user bị khoá.

### Task 2.4 — Permission helper

**File:** `frontend/src/lib/auth/permission.ts`

```typescript
export async function checkPermission(
  userId: string,
  tenantId: string,
  resource: string,
  action: 'view' | 'create' | 'edit' | 'delete'
): Promise<boolean>
```

**Logic:**
- Nếu user là `super_admin` → return true
- Nếu user là `owner` → return true (owner có full quyền)
- Nếu user là `staff` → query Permission table theo role

### Task 2.5 — Refactor login API

**File:** `frontend/src/app/api/auth/login/route.ts` (rewrite)

**POST /api/auth/login:**
- Body: `{ username, password }`
- Query User table (không phải Spa table nữa)
- Verify password bằng bcrypt
- Tạo session mới trong DB
- Trả JWT token + user info + tenant info
- Set cookie `session_token` (httpOnly, 24h)

**DELETE /api/auth/logout:**
- Xoá session khỏi DB
- Clear cookie

**Verify:** Login với admin/admin, login với owner_demo/password, login sai password.

### Task 2.6 — Refactor me API

**File:** `frontend/src/app/api/auth/me/route.ts` (rewrite)

**GET /api/auth/me:**
- Dùng `withAuth` middleware
- Trả: user info + tenant info + role + permissions

**Verify:** Gọi với token hợp lệ, token sai.

### Task 2.7 — Tenant isolation middleware

**File:** `frontend/src/lib/auth/tenant.ts`

Helper extract tenant_id từ authenticated user:

```typescript
export function getTenantId(user: AuthUser): string
// Throws if user is super_admin and no tenantId specified in query
```

**Nguyên tắc:** Mọi query nghiệp vụ PHẢI có `WHERE tenant_id = ?`.

---

## Phase 3: Core CRUD APIs

### Task 3.1 — Super Admin APIs

**Files:**
- `frontend/src/app/api/admin/tenants/route.ts` — GET (list), POST (create + owner)
- `frontend/src/app/api/admin/tenants/[id]/route.ts` — PATCH (update), DELETE (soft)
- `frontend/src/app/api/admin/users/route.ts` — GET (list all users)

**Logic POST /api/admin/tenants:**
1. Validate input (name, slug, business_type, owner info)
2. Check slug unique
3. Insert Tenant
4. Insert User (role=owner, linked to tenant)
5. Insert Branch (chi nhánh chính, is_main=1)
6. Insert BotConfig mặc định
7. Insert default Roles ("Quản lý", "Nhân viên")
8. AuditLog: create tenant

**Verify:** Tạo tenant mới qua API, kiểm tra tất cả bảng liên quan.

### Task 3.2 — Tenant settings APIs

**Files:**
- `frontend/src/app/api/tenant/settings/route.ts` — GET, PUT

**Verify:** Cập nhật tên tenant, giờ mở cửa.

### Task 3.3 — Branch APIs

**Files:**
- `frontend/src/app/api/branches/route.ts` — GET, POST
- `frontend/src/app/api/branches/[id]/route.ts` — PUT, DELETE (soft)

**Quy tắc:**
- Không thể xoá branch còn order/booking
- Không thể xoá branch `is_main = 1`
- Khi tạo branch mới, nếu là branch đầu tiên → tự set `is_main = 1`

**Verify:** CRUD branches, test xoá branch có order.

### Task 3.4 — Product Category APIs

**Files:**
- `frontend/src/app/api/categories/route.ts` — GET (tree), POST
- `frontend/src/app/api/categories/[id]/route.ts` — PUT, DELETE

**Quy tắc:**
- GET trả về cây phân cấp (nested JSON)
- Không thể xoá category còn chứa product
- Hỗ trợ tối đa 3 cấp

**Verify:** Tạo category đa cấp, test xoá category có product.

### Task 3.5 — Product APIs

**Files:**
- `frontend/src/app/api/products/route.ts` — GET (list + filter), POST
- `frontend/src/app/api/products/[id]/route.ts` — GET (detail), PUT, DELETE (soft)

**GET query params:**
- `?type=service|product|combo` — filter theo type
- `?category_id=xxx` — filter theo category
- `?active=1|0` — filter theo trạng thái
- `?search=xxx` — tìm theo tên
- `?page=1&limit=20` — pagination

**POST combo:**
- Nếu `type = 'combo'` → cùng request tạo ComboItem
- Validate: product_id trong combo phải thuộc cùng tenant

**Verify:** CRUD products, tạo combo, filter theo type.

### Task 3.6 — Customer APIs

**Files:**
- `frontend/src/app/api/customers/route.ts` — GET, POST
- `frontend/src/app/api/customers/[id]/route.ts` — GET (detail + notes), PUT, DELETE (soft)
- `frontend/src/app/api/customers/[id]/notes/route.ts` — GET, POST

**GET query params:**
- `?search=xxx` — tìm theo tên hoặc SĐT
- `?tags=vip,regular` — filter theo tags
- `?page=1&limit=20` — pagination

**Verify:** CRUD customers, thêm note, filter theo tags.

### Task 3.7 — Order APIs

**Files:**
- `frontend/src/app/api/orders/route.ts` — GET, POST
- `frontend/src/app/api/orders/[id]/route.ts` — GET (detail + items + payments)
- `frontend/src/app/api/orders/[id]/status/route.ts` — PATCH
- `frontend/src/app/api/orders/[id]/payments/route.ts` — POST

**POST /api/orders — Logic tạo đơn:**
1. Validate items (product_id tồn tại, quantity > 0)
2. Generate order_code: `ORD-{5 số tự tăng}`
3. Snapshot giá từ Product → OrderItem.unit_price
4. Tính subtotal, total
5. Insert Order + OrderItem[] trong 1 transaction
6. AuditLog: create order

**PATCH status — Logic chuyển trạng thái:**
- Validate transition hợp lệ (pending → confirmed → processing → completed)
- Không thể chuyển completed → pending
- Khi completed → update payment_status nếu đã paid

**POST payment — Logic thanh toán:**
1. Insert Payment
2. SUM tất cả Payment.amount cho order
3. Update Order.payment_status (unpaid → partial → paid)

**Verify:** Tạo đơn, chuyển trạng thái, thanh toán từng phần.

### Task 3.8 — Booking APIs

**Files:**
- `frontend/src/app/api/bookings/route.ts` — GET, POST
- `frontend/src/app/api/bookings/[id]/route.ts` — GET
- `frontend/src/app/api/bookings/[id]/status/route.ts` — PATCH
- `frontend/src/app/api/bookings/availability/route.ts` — GET

**GET /api/bookings/availability — Logic:**
- Params: `?branch_id=xxx&date=2026-06-29&product_id=xxx`
- Query booking trong ngày đó cho branch
- Trả về danh sách slot trống

**POST /api/bookings — Logic:**
1. Validate booking_start < booking_end
2. Check trùng lịch (overlapping bookings cùng branch)
3. Insert Booking + BookingItem[]
4. AuditLog

**Verify:** Tạo booking, check trùng lịch, check availability.

### Task 3.9 — Role & Permission APIs

**Files:**
- `frontend/src/app/api/roles/route.ts` — GET, POST
- `frontend/src/app/api/roles/[id]/route.ts` — PUT, DELETE
- `frontend/src/app/api/roles/[id]/permissions/route.ts` — PUT (bulk update)

**Verify:** Tạo role, gán permission, test permission check.

### Task 3.10 — Staff management APIs

**Files:**
- `frontend/src/app/api/staff/route.ts` — GET, POST (tạo staff)
- `frontend/src/app/api/staff/[id]/route.ts` — PUT, DELETE (soft)
- `frontend/src/app/api/staff/[id]/branches/route.ts` — PUT (gán branch)

**Verify:** Owner tạo staff, gán role, gán branch.

---

## Phase 4: AuditLog & Attachment

### Task 4.1 — AuditLog helper

**File:** `frontend/src/lib/audit.ts`

```typescript
export async function auditLog(params: {
  tenantId: string
  userId: string
  action: 'create' | 'update' | 'delete' | 'login' | 'logout'
  entityType: string
  entityId?: string
  oldValue?: object
  newValue?: object
  ipAddress?: string
}): Promise<void>
```

Gọi trong mọi CRUD operations quan trọng.

### Task 4.2 — Attachment upload API

**File:** `frontend/src/app/api/upload/route.ts`

- POST: upload file → trả URL
- Lưu metadata vào Attachment table
- File lưu vào Turso blob hoặc local storage

---

## Phase 5: System Settings & Cleanup

### Task 5.1 — Settings APIs

**Files:**
- `frontend/src/app/api/settings/route.ts` — GET (global), PUT (global)
- `frontend/src/app/api/tenant/settings/route.ts` — GET (tenant), PUT (tenant)

### Task 5.2 — Cleanup old files

Xoá hoặc refactor:
- `frontend/src/app/api/spa/[id]/*` — xoá toàn bộ (thay bằng routes mới)
- `frontend/src/app/api/n8n/route.ts` — xoá (không cần n8n bridge)
- `frontend/src/lib/token.ts` — xoá (thay bằng `lib/auth/jwt.ts`)

### Task 5.3 — Update db.ts

**File:** `frontend/src/lib/db.ts`

Giữ nguyên Turso client, chỉ đảm bảo:
- Export đúng
- Singleton pattern hoạt động

### Task 5.4 — Env variables

**File:** `.env.local`

```env
# Turso
DATABASE_URL=libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=<token>

# Auth
JWT_SECRET=<random-secret>

# OpenRouter (cho Plan B)
OPENROUTER_API_KEY=<key>
```

---

## Task Dependency Graph

```
Phase 0 (Prep)
    │
    ▼
Phase 1 (DB Schema)
    │
    ├── Phase 2 (Auth) ← phụ thuộc Phase 1 (bảng User, Session, Role, Permission)
    │       │
    │       ▼
    ├── Phase 3 (CRUD APIs) ← phụ thuộc Phase 2 (withAuth middleware)
    │       │
    │       ├── Task 3.1 (Admin) ← cần Phase 2
    │       ├── Task 3.2-3.3 (Tenant, Branch) ← cần Task 3.1
    │       ├── Task 3.4-3.5 (Category, Product) ← cần Task 3.3
    │       ├── Task 3.6 (Customer) ← cần Task 3.3
    │       ├── Task 3.7 (Order) ← cần Task 3.5 + 3.6
    │       ├── Task 3.8 (Booking) ← cần Task 3.5 + 3.6
    │       ├── Task 3.9 (Role) ← cần Phase 2
    │       └── Task 3.10 (Staff) ← cần Task 3.9
    │
    ├── Phase 4 (Audit + Upload) ← phụ thuộc Phase 3
    │
    └── Phase 5 (Cleanup) ← phụ thuộc Phase 3
```

---

## Parallel Execution Opportunities

**Có thể chạy song song:**
- Phase 2 (Auth) ∥ Task 4.1 (AuditLog helper)
- Task 3.4 (Category) ∥ Task 3.6 (Customer) — không phụ thuộc nhau
- Task 3.7 (Order) ∥ Task 3.8 (Booking) — không phụ thuộc nhau
- Task 3.9 (Role) ∥ Task 3.4-3.8 — không phụ thuộc nhau

---

## Verify Checklist (cuối Plan A)

- [ ] 23 bảng tồn tại trên Turso
- [ ] Seed data chạy thành công
- [ ] Login admin/admin → thành công
- [ ] Login owner_demo/password → thành công
- [ ] Tạo tenant mới qua API → tất cả bảng liên quan được tạo
- [ ] CRUD products (service, product, combo)
- [ ] CRUD customers + notes
- [ ] Tạo order → thanh toán → payment_status update đúng
- [ ] Tạo booking → check trùng lịch hoạt động
- [ ] AuditLog ghi lại mọi thay đổi
- [ ] Tenant isolation: không cross-tenant data leak
- [ ] Staff permission check hoạt động
