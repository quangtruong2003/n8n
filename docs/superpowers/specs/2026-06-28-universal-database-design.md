# Universal Business Database — Design Spec

> **Project:** GHOST-WORKER
> **Date:** 2026-06-28
> **Approach:** Structured Universal (Approach 1)
> **Scope:** MVP
> **Database:** Turso (SQLite-based, distributed)

---

## 1. Overview

### 1.1 Mục tiêu

Xây dựng database **universal** quản lý BẤT KỲ loại hình kinh doanh nào (spa, cửa hàng vật tư nông nghiệp, quán cafe, cho thuê...) trong cùng 1 database. Không hardcode ngành — mọi ngành dùng chung schema, phân biệt bằng dữ liệu.

### 1.2 Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                      NEXT.JS BACKEND                        │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Admin API    │  │  Zalo Bot     │  │  Web Widget   │   │
│  │  (CRUD)       │  │  (zca-js)     │  │  (Chat API)   │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
│          │                  │                   │           │
│          └──────────┬───────┴───────────────────┘           │
│                     ▼                                       │
│              ┌─────────────┐                                │
│              │  OpenRouter  │ ← AI Engine (per-tenant)      │
│              └─────────────┘                                │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
              ┌─────────────────┐
              │   Turso (SQLite) │ ← 22 bảng
              └─────────────────┘
```

### 1.3 Stack công nghệ

| Component | Technology |
|-----------|-----------|
| Backend | Next.js App Router (API Routes) |
| Database | Turso (libsql, distributed SQLite) |
| ORM/Driver | `@libsql/client` (native, không ORM) |
| Auth | JWT (jsonwebtoken) |
| Password | bcrypt |
| Zalo Integration | zca-js (unofficial Zalo API) |
| AI Engine | OpenRouter API |
| Web Widget | Vanilla JS embed script |

### 1.4 Nguyên tắc thiết kế

1. **Tối đa bảng chung** — mọi ngành dùng chung schema, phân biệt bằng `type`, `metadata`
2. **Multi-tenant cách ly** — mọi bảng có `tenant_id`, query luôn filter theo tenant
3. **UUID cho mọi PK** — không dùng auto-increment, dễ distributed
4. **INTEGER cho tiền** — không dùng FLOAT, tránh sai số (đơn vị: VND)
5. **JSON metadata** — cột `metadata TEXT (JSON)` cho phần tuỳ biến ngành
6. **Soft delete** — không xoá cứng, đánh dấu `active = 0`
7. **Audit trail** — ghi lại mọi thay đổi quan trọng

---

## 2. System Architecture

### 2.1 Tenant Model (Multi-tenancy)

```
Super Admin (bạn)
    │
    ├── Tenant A (Spa Quang Truong)
    │     ├── Owner: Nguyễn Văn A
    │     ├── Branch: Q1, Q3, Thủ Đức
    │     ├── Staff: Thu ngân, Kỹ thuật viên
    │     └── Products, Orders, Bookings, Chat...
    │
    ├── Tenant B (Vật Tư Nông Nghiệp ABC)
    │     ├── Owner: Trần Thị B
    │     ├── Branch: Chi nhánh 1, Chi nhánh 2
    │     ├── Staff: Bán hàng, Kho
    │     └── Products, Orders, Inventory...
    │
    └── Tenant C (Cafe DEF)
          ├── Owner: Lê Văn C
          └── ...
```

**Cách ly dữ liệu:**
- Mọi query nghiệp vụ PHẢI có `WHERE tenant_id = ?`
- Staff chỉ thấy dữ liệu trong tenant + branch được gán
- Owner thấy mọi dữ liệu trong tenant mình
- Super Admin thấy mọi thứ

### 2.2 Auth Model

```
┌───────────────┐
│  Super Admin  │ ← admin/admin (mặc định)
│  (1 account)  │ ← tạo Owner accounts
└───────┬───────┘
        ▼
┌───────────────┐
│    Owner      │ ← username/password (do Super Admin tạo)
│  (per tenant) │ ← quản lý business + tạo Staff
└───────┬───────┘
        ▼
┌───────────────┐
│    Staff      │ ← username/password (do Owner tạo)
│  (per tenant) │ ← quyền hạn theo Role
└───────────────┘
```

**Default admin:** `admin` / `admin` (phải đổi password sau lần login đầu)

### 2.3 Bot Architecture

**2 bots, 1 AI engine:**

| | Zalo Bot | Web Widget Bot |
|---|---------|----------------|
| Kênh | Zalo (qua zca-js) | Web (embed script) |
| Trạng thái | Luôn bật (cookies lưu DB) | Tạm thời (mỗi phiên) |
| Lịch sử | Giữ nguyên trên Zalo | Reset khi đóng widget |
| Mục đích chính | Đặt lịch, thông báo, chăm sóc KH | Tư vấn, hỏi đáp, dẫn sang Zalo |
| Notification | Push notification tự nhiên | Không có |

**Flow chính — Web → Zalo:**
1. Khách mở website → chat với Web Widget bot
2. Khách hỏi thông tin (giá, dịch vụ, sản phẩm...)
3. Khách muốn đặt lịch → bot hỏi SĐT
4. Backend kiểm tra SĐT → match Zalo user
5. Bot Web trả lời: "Vui lòng qua Zalo để tiếp tục đặt lịch và nhận thông báo!"
6. Khách qua Zalo → bot Zalo tiếp tục (có context từ web)
7. Mọi thông báo sau đó → qua Zalo (xác nhận, nhắc lịch, trạng thái...)

---

## 3. Database Schema — Chi tiết từng bảng

### 3.1 Auth & Platform Layer

#### 3.1.1 User

Tài khoản cho tất cả: super admin, owner, staff.

```sql
CREATE TABLE User (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('super_admin', 'owner', 'staff')),
    tenant_id       TEXT REFERENCES Tenant(id),
    full_name       TEXT,
    phone           TEXT,
    email           TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index
CREATE INDEX idx_user_tenant ON User(tenant_id);
CREATE INDEX idx_user_username ON User(username);
```

**Quy tắc nghiệp vụ:**
- `role = 'super_admin'` → `tenant_id = NULL` (không thuộc tenant nào)
- `role = 'owner'` → `tenant_id` bắt buộc
- `role = 'staff'` → `tenant_id` bắt buộc
- Username toàn hệ thống unique (không trùng dù khác tenant)
- Password hash bằng bcrypt (salt rounds = 10)
- Khi owner bị `active = 0`, KHÔNG tự động khoá staff (để owner có thể được mở lại)

#### 3.1.2 Session

Phiên đăng nhập, quản lý JWT tokens.

```sql
CREATE TABLE Session (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES User(id),
    token           TEXT NOT NULL UNIQUE,
    expires_at      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_session_token ON Session(token);
CREATE INDEX idx_session_user ON Session(user_id);
```

**Quy tắc nghiệp vụ:**
- Login → tạo session mới, trả JWT token
- Logout → xoá session
- Token hết hạn → buộc login lại
- Mỗi user có thể có nhiều session (đa thiết bị)
- Cleanup sessions hết hạn định kỳ (cron job)

#### 3.1.3 Role

Vai trò nhân viên (per tenant).

```sql
CREATE TABLE Role (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_role_tenant ON Role(tenant_id);
```

**Quy tắc nghiệp vụ:**
- Owner tạo role: "Thu ngân", "Kỹ thuật viên", "Quản lý ca", "Bán hàng"...
- Role name unique trong mỗi tenant
- Không thể xoá role đang được gán cho user

#### 3.1.4 Permission

Quyền hạn chi tiết cho từng role.

```sql
CREATE TABLE Permission (
    id              TEXT PRIMARY KEY,
    role_id         TEXT NOT NULL REFERENCES Role(id),
    resource        TEXT NOT NULL,
    can_view        INTEGER NOT NULL DEFAULT 0,
    can_create      INTEGER NOT NULL DEFAULT 0,
    can_edit        INTEGER NOT NULL DEFAULT 0,
    can_delete      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(role_id, resource)
);

CREATE INDEX idx_permission_role ON Permission(role_id);
```

**Giá trị resource hợp lệ:**
- `product` — Sản phẩm / Dịch vụ
- `order` — Đơn hàng
- `booking` — Lịch hẹn
- `customer` — Khách hàng
- `payment` — Thanh toán
- `chat` — Chat / Bot
- `report` — Báo cáo
- `staff` — Quản lý nhân viên
- `setting` — Cài đặt

**Quy tắc nghiệp vụ:**
- Staff chỉ có 1 role
- Khi chưa gán role: mặc định `can_view = 1` trên mọi resource
- Super Admin bypass mọi permission check
- Owner có full quyền trong tenant mình

---

### 3.2 Tenant & Organization Layer

#### 3.2.1 Tenant

Doanh nghiệp / Tổ chức.

```sql
CREATE TABLE Tenant (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    business_type   TEXT NOT NULL DEFAULT 'other'
                        CHECK(business_type IN ('spa', 'retail', 'fnb', 'rental', 'service', 'other')),
    phone           TEXT,
    email           TEXT,
    address         TEXT,
    logo_url        TEXT,
    open_time       TEXT DEFAULT '08:00',
    close_time      TEXT DEFAULT '22:00',
    active          INTEGER NOT NULL DEFAULT 1,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tenant_slug ON Tenant(slug);
CREATE INDEX idx_tenant_active ON Tenant(active);
```

**Quy tắc nghiệp vụ:**
- Super Admin tạo tenant, gán owner
- `slug` dùng cho URL: `app.com/s/{slug}`, widget embed `app.com/api/widget/{slug}`
- `business_type` chỉ là label phân loại (hiển thị UI, báo cáo). KHÔNG ảnh hưởng logic xử lý
- `metadata` ví dụ:
  ```json
  {"currency": "VND", "timezone": "Asia/Ho_Chi_Minh", "tax_rate": 10}
  ```
- `active = 0`: mọi user thuộc tenant không thể login, dữ liệu vẫn giữ
- Slug format: lowercase, kebab-case, chỉ chữ cái và số và dấu gạch ngang

#### 3.2.2 Branch

Chi nhánh.

```sql
CREATE TABLE Branch (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    name            TEXT NOT NULL,
    address         TEXT,
    phone           TEXT,
    is_main         INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_branch_tenant ON Branch(tenant_id);
```

**Quy tắc nghiệp vụ:**
- Mỗi tenant PHẢI có ít nhất 1 branch (`is_main = 1`)
- Chỉ 1 branch `is_main = 1` per tenant
- Không thể xoá branch còn đơn hàng/booking liên quan
- `metadata` ví dụ: `{"latitude": 10.77, "longitude": 106.69}`

#### 3.2.3 UserBranch

Gán nhân viên vào chi nhánh.

```sql
CREATE TABLE UserBranch (
    user_id         TEXT NOT NULL REFERENCES User(id),
    branch_id       TEXT NOT NULL REFERENCES Branch(id),
    PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX idx_userbranch_branch ON UserBranch(branch_id);
```

**Quy tắc nghiệp vụ:**
- Many-to-many: 1 staff làm việc ở nhiều chi nhánh
- Staff chỉ thấy/thao tác dữ liệu trong branch được gán
- Owner không cần gán branch (thấy hết trong tenant)

---

### 3.3 Product & Service Layer

#### 3.3.1 ProductCategory

Danh mục sản phẩm/dịch vụ (hỗ trợ cây phân cấp).

```sql
CREATE TABLE ProductCategory (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    parent_id       TEXT REFERENCES ProductCategory(id),
    name            TEXT NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_category_tenant ON ProductCategory(tenant_id);
CREATE INDEX idx_category_parent ON ProductCategory(parent_id);
```

**Quy tắc nghiệp vụ:**
- Hỗ trợ đa cấp: Cha → Con → Cháu (tối đa 3 cấp)
- Ví dụ Spa: "Massage" → "Massage Body", "Massage Mặt"
- Ví dụ Shop: "Phân bón" → "Phân hữu cơ", "Phân vô cơ"
- Ví dụ Cafe: "Đồ uống" → "Cà phê", "Trà", "Nước ép"
- Không thể xoá danh mục còn chứa sản phẩm

#### 3.3.2 Product

**Bảng trung tâm** — chứa tất cả mặt hàng: dịch vụ, hàng hoá, combo.

```sql
CREATE TABLE Product (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES Tenant(id),
    category_id         TEXT REFERENCES ProductCategory(id),
    name                TEXT NOT NULL,
    type                TEXT NOT NULL CHECK(type IN ('service', 'product', 'combo')),
    description         TEXT,
    price               INTEGER NOT NULL DEFAULT 0,
    cost_price          INTEGER,
    sku                 TEXT,
    unit                TEXT DEFAULT 'cái',
    duration_minutes    INTEGER,
    image_url           TEXT,
    active              INTEGER NOT NULL DEFAULT 1,
    metadata            TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_product_tenant ON Product(tenant_id);
CREATE INDEX idx_product_category ON Product(category_id);
CREATE INDEX idx_product_type ON Product(type);
CREATE INDEX idx_product_sku ON Product(tenant_id, sku);
```

**Giá trị type:**

| type | Ý nghĩa | Ví dụ |
|------|----------|-------|
| `service` | Dịch vụ (không quản lý tồn kho) | Massage, cắt tóc, sửa chữa |
| `product` | Hàng hoá vật lý (quản lý tồn kho) | Phân bón, mỹ phẩm, đồ ăn |
| `combo` | Gói kết hợp nhiều item | Combo spa, combo ăn trưa |

**Quy tắc nghiệp vụ:**
- `price` luôn INTEGER (VND), không dùng FLOAT
- `cost_price` nullable — tính lợi nhuận khi có
- `duration_minutes` chỉ dùng cho `type = 'service'`
- `sku` nullable, unique trong mỗi tenant
- `active = 0`: ẩn khỏi danh sách nhưng giữ trong đơn cũ
- `metadata` ví dụ theo ngành:
  - Spa: `{"skin_type": "all", "contraindications": ["pregnancy"]}`
  - Shop: `{"weight": "50kg", "origin": "Đà Lạt", "expiry_months": 24}`
  - Cafe: `{"size": "L", "ice_level": ["less", "normal", "more"]}`

#### 3.3.3 ComboItem

Chi tiết combo (sản phẩm con trong combo).

```sql
CREATE TABLE ComboItem (
    id              TEXT PRIMARY KEY,
    combo_id        TEXT NOT NULL REFERENCES Product(id),
    product_id      TEXT NOT NULL REFERENCES Product(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    UNIQUE(combo_id, product_id)
);

CREATE INDEX idx_comboitem_combo ON ComboItem(combo_id);
```

**Quy tắc nghiệp vụ:**
- Chỉ liên kết Product có `type = 'combo'`
- Khi tính tiền, hệ thống expand combo thành các item riêng
- Không cho phép combo chứa combo khác (chỉ 1 cấp)

---

### 3.4 Customer Layer

#### 3.4.1 Customer

Khách hàng.

```sql
CREATE TABLE Customer (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    name            TEXT NOT NULL DEFAULT 'Khách vãng lai',
    phone           TEXT,
    email           TEXT,
    gender          TEXT CHECK(gender IN ('male', 'female', 'other')),
    date_of_birth   TEXT,
    address         TEXT,
    notes           TEXT,
    tags            TEXT DEFAULT '[]',
    metadata        TEXT DEFAULT '{}',
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customer_tenant ON Customer(tenant_id);
CREATE INDEX idx_customer_phone ON Customer(tenant_id, phone);
```

**Quy tắc nghiệp vụ:**
- Customer chung cho MỌI hoạt động (mua hàng, booking, chat)
- Cùng 1 người có thể là customer của nhiều tenant (dữ liệu cách ly theo tenant_id)
- `tags` JSON array: `["vip", "regular", "new"]`
- `metadata` theo ngành:
  - Spa: `{"skin_type": "oily", "allergies": ["paraben"]}`
  - Shop: `{"company_name": "HTX Nông nghiệp A", "tax_code": "0123456789"}`
- Soft delete (`active = 0`) — không xoá cứng để giữ lịch sử
- Phone unique trong mỗi tenant (không bắt buộc nhưng khuyến khích)

#### 3.4.2 CustomerNote

Lịch sử ghi chú khách hàng.

```sql
CREATE TABLE CustomerNote (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL REFERENCES Customer(id),
    user_id         TEXT NOT NULL REFERENCES User(id),
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customernote_customer ON CustomerNote(customer_id);
```

**Quy tắc nghiệp vụ:**
- Ghi chú lịch sử: "Khách dị ứng mỹ phẩm A", "Thích nhân viên B"...
- Append-only — không sửa, không xoá (để giữ lịch sử)
- Ghi rõ ai ghi, khi nào

---

### 3.5 Order & Payment Layer

#### 3.5.1 Order

**Bảng trung tâm cho MỌI giao dịch.**

```sql
CREATE TABLE "Order" (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    branch_id       TEXT NOT NULL REFERENCES Branch(id),
    customer_id     TEXT REFERENCES Customer(id),
    user_id         TEXT NOT NULL REFERENCES User(id),
    order_code      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled', 'refunded')),
    subtotal        INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    tax_amount      INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    payment_status  TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
    note            TEXT,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, order_code)
);

CREATE INDEX idx_order_tenant ON "Order"(tenant_id);
CREATE INDEX idx_order_branch ON "Order"(branch_id);
CREATE INDEX idx_order_customer ON "Order"(customer_id);
CREATE INDEX idx_order_user ON "Order"(user_id);
CREATE INDEX idx_order_status ON "Order"(tenant_id, status);
CREATE INDEX idx_order_code ON "Order"(tenant_id, order_code);
CREATE INDEX idx_order_created ON "Order"(tenant_id, created_at);
```

> **Lưu ý:** Tên bảng `"Order"` cần double-quote vì `ORDER` là keyword SQL.

**Luồng trạng thái:**

```
pending → confirmed → processing → completed
   │                                      │
   └→ cancelled                            └→ refunded
```

- `pending` — mới tạo, chờ xác nhận
- `confirmed` — đã xác nhận
- `processing` — đang thực hiện (đang làm spa, đang nấu...)
- `completed` — hoàn thành
- `cancelled` — huỷ (trước khi processing)
- `refunded` — đã hoàn tiền (sau khi completed)

**Quy tắc nghiệp vụ:**
- `order_code` tự tăng theo tenant: `ORD-00001`, `ORD-00002`... Format: `ORD-{5 chữ số}`
- `total = subtotal - discount_amount + tax_amount`
- Đơn huỷ giữ nguyên dữ liệu, KHÔNG xoá
- Staff chỉ thấy đơn mình tạo, trừ owner thấy hết
- `metadata` theo ngành:
  - Cafe: `{"table_number": 5}`
  - Shop: `{"delivery_address": "123 ABC", "delivery_method": "ship"}`
  - Spa: `{"booking_id": "..."}`

#### 3.5.2 OrderItem

Chi tiết đơn hàng.

```sql
CREATE TABLE OrderItem (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES "Order"(id),
    product_id      TEXT NOT NULL REFERENCES Product(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL,
    note            TEXT,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_orderitem_order ON OrderItem(order_id);
```

**Quy tắc nghiệp vụ:**
- `unit_price` = giá tại thời điểm bán (snapshot), KHÔNG linked tới giá hiện tại
- `total = quantity * unit_price - discount_amount`
- Khi product là combo, expand thành item riêng
- `metadata.staff_assigned` = nhân viên phục vụ (tính hoa hồng)
- Không sửa OrderItem sau khi order `completed`

#### 3.5.3 Payment

Thanh toán.

```sql
CREATE TABLE Payment (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES "Order"(id),
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    amount          INTEGER NOT NULL,
    method          TEXT NOT NULL CHECK(method IN ('cash', 'transfer', 'card', 'momo', 'zalopay', 'other')),
    reference       TEXT,
    note            TEXT,
    paid_at         TEXT NOT NULL,
    created_by      TEXT NOT NULL REFERENCES User(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payment_order ON Payment(order_id);
CREATE INDEX idx_payment_tenant ON Payment(tenant_id);
```

**Quy tắc nghiệp vụ:**
- 1 đơn có thể có N lần thanh toán (thanh toán từng phần)
- Khi SUM(Payment.amount) >= Order.total → `payment_status = 'paid'`
- Khi 0 < SUM < Order.total → `payment_status = 'partial'`
- Payment append-only — không xoá. Muốn hoàn tiền → tạo payment âm hoặc status `refunded`
- `reference` = mã giao dịch ngân hàng/ví điện tử (nullable cho cash)

---

### 3.6 Booking Layer

#### 3.6.1 Booking

Lịch hẹn / Đặt chỗ.

```sql
CREATE TABLE Booking (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    branch_id       TEXT NOT NULL REFERENCES Branch(id),
    customer_id     TEXT NOT NULL REFERENCES Customer(id),
    order_id        TEXT REFERENCES "Order"(id),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    booking_start   TEXT NOT NULL,
    booking_end     TEXT NOT NULL,
    note            TEXT,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_booking_tenant ON Booking(tenant_id);
CREATE INDEX idx_booking_branch ON Booking(branch_id);
CREATE INDEX idx_booking_customer ON Booking(customer_id);
CREATE INDEX idx_booking_time ON Booking(branch_id, booking_start, booking_end);
CREATE INDEX idx_booking_status ON Booking(tenant_id, status);
```

**Luồng trạng thái:**

```
pending → confirmed → in_progress → completed
   │                                    │
   └→ cancelled      └→ no_show         └→ (tạo Order)
```

**Quy tắc nghiệp vụ:**
- `booking_start`, `booking_end` = ISO timestamp
- Check trùng lịch: không cho 2 booking cùng branch + overlapping time (nếu có gán staff)
- Khi `completed` → tự tạo Order tương ứng (nếu chưa có `order_id`)
- `metadata.source`: `zalo`, `facebook`, `web`, `walk_in`, `phone`
- `no_show`: khách không đến (sau thời gian booking_end + buffer)

#### 3.6.2 BookingItem

Sản phẩm/dịch vụ trong booking.

```sql
CREATE TABLE BookingItem (
    id              TEXT PRIMARY KEY,
    booking_id      TEXT NOT NULL REFERENCES Booking(id),
    product_id      TEXT NOT NULL REFERENCES Product(id),
    staff_id        TEXT REFERENCES User(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    price           INTEGER NOT NULL
);

CREATE INDEX idx_bookingitem_booking ON BookingItem(booking_id);
```

**Quy tắc nghiệp vụ:**
- 1 booking chứa nhiều dịch vụ/sản phẩm
- `staff_id` nullable — chỉ định nhân viên cụ thể (spa: kỹ thuật viên yêu thích)
- `price` = giá tại thời điểm đặt (snapshot)

---

### 3.7 Chat & Bot Layer

#### 3.7.1 BotConfig

Cấu hình bot per tenant.

```sql
CREATE TABLE BotConfig (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL UNIQUE REFERENCES Tenant(id),
    bot_name            TEXT DEFAULT 'Trợ lý ảo',
    greeting            TEXT DEFAULT 'Xin chào! Tôi có thể giúp gì cho bạn?',
    ai_enabled          INTEGER NOT NULL DEFAULT 1,
    ai_model            TEXT DEFAULT 'openai/gpt-4o-mini',
    ai_system_prompt    TEXT,
    working_hours_only  INTEGER NOT NULL DEFAULT 0,
    channels            TEXT DEFAULT '["web"]',
    -- Zalo credentials (encrypted)
    zalo_cookies        TEXT,
    zalo_imei           TEXT,
    zalo_user_agent     TEXT,
    zalo_connected      INTEGER NOT NULL DEFAULT 0,
    zalo_account_name   TEXT,
    -- Web widget config
    web_widget_theme    TEXT DEFAULT '{"primaryColor":"#4F46E5","position":"bottom-right"}',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_botconfig_tenant ON BotConfig(tenant_id);
```

**Quy tắc nghiệp vụ:**

*Zalo (zca-js):*
- Owner quét QR 1 lần → backend lưu cookies/IMEI/user_agent
- Backend restart → dùng cookies reconnect (không cần quét lại QR)
- Session expired → `zalo_connected = 0` → owner quét QR lại
- Cookies được mã hoá trước khi lưu DB
- Giới hạn: chỉ 1 listener per Zalo account

*Web Widget:*
- Owner lấy embed code: `<script src="app.com/api/widget/{slug}"></script>`
- Floating button góc phải → mở chat box
- `web_widget_theme` tuỳ chỉnh: màu sắc, vị trí

*AI:*
- `ai_model`: model OpenRouter (mặc định `openai/gpt-4o-mini`)
- `ai_system_prompt`: kịch bản chat per tenant (owner tự cấu hình)
- Backend inject danh sách dịch vụ/sản phẩm vào context khi gọi AI
- `working_hours_only = 1`: ngoài giờ → AI trả lời "Nhân viên sẽ liên hệ lại"

#### 3.7.2 ChatSession

Phiên chat (gom nhóm tin nhắn).

```sql
CREATE TABLE ChatSession (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES Tenant(id),
    customer_id         TEXT REFERENCES Customer(id),
    channel             TEXT NOT NULL CHECK(channel IN ('zalo', 'web')),
    status              TEXT NOT NULL DEFAULT 'bot_handling'
                            CHECK(status IN ('active', 'bot_handling', 'staff_handling', 'resolved')),
    assigned_staff_id   TEXT REFERENCES User(id),
    last_message_at     TEXT,
    metadata            TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_chatsession_tenant ON ChatSession(tenant_id);
CREATE INDEX idx_chatsession_customer ON ChatSession(customer_id);
CREATE INDEX idx_chatsession_status ON ChatSession(tenant_id, status);
CREATE INDEX idx_chatsession_last ON ChatSession(tenant_id, last_message_at);
```

**Luồng trạng thái:**
```
bot_handling → staff_handling → resolved
      │              │
      └→ active ─────┘ (khi KH gửi tin mới sau resolved)
```

**Quy tắc nghiệp vụ:**
- Dashboard hiển thị danh sách ChatSession, sắp xếp theo `last_message_at`
- Staff click "Nhận chat" → `assigned_staff_id` = staff, `status = staff_handling`
- Khi staff nhảy vào → AI ngưng reply cho session đó
- Staff click "Kết thúc" → `status = resolved`
- `metadata.zalo_thread_id` = thread ID trên Zalo (liên kết với zca-js)
- `metadata.customer_name` = tên hiển thị nhanh (không cần query customer)

#### 3.7.3 ChatMessage

Tin nhắn chat.

```sql
CREATE TABLE ChatMessage (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    session_id      TEXT NOT NULL REFERENCES ChatSession(id),
    customer_id     TEXT REFERENCES Customer(id),
    branch_id       TEXT REFERENCES Branch(id),
    sender          TEXT NOT NULL CHECK(sender IN ('customer', 'bot', 'staff')),
    content         TEXT NOT NULL,
    channel         TEXT NOT NULL CHECK(channel IN ('zalo', 'web')),
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_chatmessage_session ON ChatMessage(session_id);
CREATE INDEX idx_chatmessage_tenant ON ChatMessage(tenant_id);
CREATE INDEX idx_chatmessage_customer ON ChatMessage(customer_id);
CREATE INDEX idx_chatmessage_created ON ChatMessage(session_id, created_at);
```

**Quy tắc nghiệp vụ:**
- Append-only — KHÔNG sửa, KHÔNG xoá
- `sender = 'customer'`: khách gửi
- `sender = 'bot'`: AI trả lời
- `sender = 'staff'`: nhân viên trả lời
- `metadata` ví dụ:
  ```json
  {
    "zalo_thread_id": "123456",
    "ai_model_used": "openai/gpt-4o-mini",
    "response_time_ms": 350,
    "staff_user_id": "user_abc"
  }
  ```

---

### 3.8 System Layer

#### 3.8.1 Attachment

File đính kèm (polymorphic).

```sql
CREATE TABLE Attachment (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    file_size       INTEGER,
    mime_type       TEXT,
    created_by      TEXT NOT NULL REFERENCES User(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attachment_entity ON Attachment(entity_type, entity_id);
CREATE INDEX idx_attachment_tenant ON Attachment(tenant_id);
```

**Giá trị entity_type hợp lệ:**
- `product` — Ảnh sản phẩm
- `customer` — Ảnh/hồ sơ khách hàng
- `order` — Hoá đơn, biên lai
- `booking` — File liên quan
- `chat` — File gửi trong chat

#### 3.8.2 AuditLog

Nhật ký thay đổi.

```sql
CREATE TABLE AuditLog (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    user_id         TEXT NOT NULL REFERENCES User(id),
    action          TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'login', 'logout', 'export')),
    entity_type     TEXT NOT NULL,
    entity_id       TEXT,
    old_value       TEXT,
    new_value       TEXT,
    ip_address      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_auditlog_tenant ON AuditLog(tenant_id);
CREATE INDEX idx_auditlog_entity ON AuditLog(entity_type, entity_id);
CREATE INDEX idx_auditlog_created ON AuditLog(tenant_id, created_at);
CREATE INDEX idx_auditlog_user ON AuditLog(user_id);
```

**Quy tắc nghiệp vụ:**
- Ghi lại MỌI thay đổi quan trọng
- `old_value`, `new_value` = JSON snapshot
- Append-only — KHÔNG bao giờ xoá
- Super Admin xem log mọi tenant
- Owner xem log trong tenant mình
- Dùng cho: "ai sửa giá?", "ai xoá đơn?", "ai login lúc mấy giờ?"

#### 3.8.3 Setting

Cấu hình key-value.

```sql
CREATE TABLE Setting (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT,
    key             TEXT NOT NULL,
    value           TEXT,
    description     TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, key)
);

CREATE INDEX idx_setting_tenant ON Setting(tenant_id);
CREATE INDEX idx_setting_key ON Setting(key);
```

**Quy tắc nghiệp vụ:**
- `tenant_id = NULL` → global setting (tên app, version, maintenance mode...)
- `tenant_id != NULL` → tenant setting (thuế suất, format ngày...)
- Key unique theo scope

---

## 4. Mối quan hệ giữa các bảng

```
                    ┌──────────────┐
                    │   Tenant     │
                    └──────┬───────┘
           ┌───────┬───────┼────────┬──────────┬──────────┐
           ▼       ▼       ▼        ▼          ▼          ▼
        Branch   User   Product  Customer   Order     Booking
          │       │    Category    │          │          │
          │       ▼       │        │          │          │
          │     Role      ▼        │          ▼          ▼
          │       │     Product    │      OrderItem  BookingItem
          │       ▼       │        │          │
          │  Permission   ├─Combo  │          ▼
          │               │  Item  │      Payment
          │               │        │
          ├─UserBranch     │    CustomerNote
          │               │
          │            BotConfig
          │               │
          │          ChatSession
          │               │
          │          ChatMessage
          │
          ├─ Attachment (polymorphic)
          ├─ AuditLog
          └─ Setting
```

**Bảng tổng hợp:**

| Nhóm | Số bảng | Bảng |
|------|---------|------|
| Auth | 4 | User, Session, Role, Permission |
| Organization | 3 | Tenant, Branch, UserBranch |
| Product | 3 | ProductCategory, Product, ComboItem |
| Customer | 2 | Customer, CustomerNote |
| Order | 3 | Order, OrderItem, Payment |
| Booking | 2 | Booking, BookingItem |
| Chat | 3 | BotConfig, ChatSession, ChatMessage |
| System | 3 | Attachment, AuditLog, Setting |
| **Tổng** | **23** | |

---

## 5. Migration Strategy

### 5.1 Từ DB hiện tại sang DB mới

DB hiện tại có 7 bảng: `Spa`, `SpaConfig`, `Branch`, `Service`, `Customer`, `Booking`, `ChatLog`.

**Mapping:**

| Bảng cũ | → | Bảng mới | Thay đổi |
|---------|---|----------|----------|
| Spa | → | Tenant + User (owner) | Tách ra: Tenant chứa info business, User chứa auth |
| SpaConfig | → | BotConfig | Mở rộng thêm Zalo, AI, widget config |
| Branch | → | Branch | Giữ nguyên, thêm metadata |
| Service | → | Product (type='service') | Đổi tên, thêm type, category, cost_price, sku, unit |
| Customer | → | Customer | Thêm gender, dob, address, tags, metadata |
| Booking | → | Booking + BookingItem | Tách item ra, thêm order_id |
| ChatLog | → | ChatSession + ChatMessage | Tách session riêng, thêm channel, status |
| (mới) | | User, Session, Role, Permission | Hệ thống auth mới |
| (mới) | | ProductCategory | Danh mục sản phẩm |
| (mới) | | Order, OrderItem, Payment | Hệ thống đơn hàng |
| (mới) | | CustomerNote | Ghi chú khách hàng |
| (mới) | | ComboItem | Chi tiết combo |
| (mới) | | Attachment, AuditLog, Setting | Hệ thống |

### 5.2 Seed Data mặc định

```
1. Super Admin: admin / admin
2. Demo Tenant: "Spa Quang Truong Demo"
   - Owner: owner_demo / password
   - 3 branches: Q1, Q3, Thủ Đức
   - 10 services (từ seed.ts hiện tại)
   - 8 customers (từ seed.ts hiện tại)
   - BotConfig mặc định
   - 2 roles: "Quản lý", "Nhân viên"
```

---

## 6. Security

### 6.1 Authentication

- JWT token, expires trong 24h
- Password hash: bcrypt, salt rounds = 10
- Rate limit login: 5 lần/thất bại → khoá 15 phút

### 6.2 Authorization

- Middleware kiểm tra JWT trên mọi API route
- Staff permission check trước mỗi CRUD operation
- Tenant isolation: mọi query phải có `tenant_id` filter

### 6.3 Data Protection

- Zalo cookies mã hoá trước khi lưu DB (AES-256)
- Customer PII (phone, email) chỉ hiển thị khi có quyền
- AuditLog ghi lại mọi thay đổi
- Không log password, token, cookies vào console

### 6.4 API Security

- CORS: chỉ cho phép domain của widget
- Rate limit: 100 requests/phút per IP cho public endpoints
- Input validation: validate mọi parameter trước khi query

---

## 7. Constraints & Assumptions

### 7.1 Constraints

- Chạy trên Turso (SQLite) — không dùng features unsupported
- Solo founder — giữ đơn giản, dễ maintain
- MVP — không over-engineer
- Tiếng Việt là ngôn ngữ chính

### 7.2 Assumptions

- Mỗi tenant có < 10,000 products, < 100,000 orders
- Staff < 50 người per tenant
- Chat volume < 1,000 messages/ngày per tenant
- OpenRouter API key do platform owner quản lý (hiện tại)

### 7.3 Out of Scope (MVP)

- ❌ Inventory management chi tiết (nhập/xuất/tồn kho)
- ❌ Accounting / Sổ kế toán
- ❌ Loyalty / Điểm thưởng
- ❌ Multi-currency
- ❌ Workflow automation
- ❌ Notification system (email, SMS, push)
- ❌ Import/Export data
- ❌ Report nâng cao (biểu đồ, dashboard analytics)
- ❌ Custom field động (EAV)

---

## 8. API Endpoints Overview

### 8.1 Auth
- `POST /api/auth/login` — Đăng nhập
- `POST /api/auth/logout` — Đăng xuất
- `GET /api/auth/me` — Thông tin user hiện tại

### 8.2 Super Admin
- `GET /api/admin/tenants` — Danh sách tenants
- `POST /api/admin/tenants` — Tạo tenant + owner
- `PATCH /api/admin/tenants/:id` — Cập nhật tenant
- `GET /api/admin/users` — Danh sách users toàn hệ thống

### 8.3 Tenant (Owner)
- `GET /api/tenant/settings` — Cài đặt tenant
- `PUT /api/tenant/settings` — Cập nhật cài đặt

### 8.4 Branches
- `GET /api/branches` — Danh sách chi nhánh
- `POST /api/branches` — Tạo chi nhánh
- `PUT /api/branches/:id` — Cập nhật
- `DELETE /api/branches/:id` — Xoá (soft)

### 8.5 Products
- `GET /api/products` — Danh sách sản phẩm/dịch vụ
- `POST /api/products` — Tạo mới
- `PUT /api/products/:id` — Cập nhật
- `DELETE /api/products/:id` — Xoá (soft)
- `GET /api/categories` — Danh mục
- `POST /api/categories` — Tạo danh mục

### 8.6 Customers
- `GET /api/customers` — Danh sách KH
- `POST /api/customers` — Tạo mới
- `PUT /api/customers/:id` — Cập nhật
- `GET /api/customers/:id/notes` — Ghi chú KH
- `POST /api/customers/:id/notes` — Thêm ghi chú

### 8.7 Orders
- `GET /api/orders` — Danh sách đơn hàng
- `POST /api/orders` — Tạo đơn
- `PATCH /api/orders/:id/status` — Cập nhật trạng thái
- `GET /api/orders/:id` — Chi tiết đơn
- `POST /api/orders/:id/payments` — Thanh toán

### 8.8 Bookings
- `GET /api/bookings` — Danh sách lịch hẹn
- `POST /api/bookings` — Tạo lịch
- `PATCH /api/bookings/:id/status` — Cập nhật trạng thái
- `GET /api/bookings/availability` — Kiểm tra trống

### 8.9 Chat & Bot
- `GET /api/chat/sessions` — Danh sách phiên chat
- `GET /api/chat/sessions/:id/messages` — Tin nhắn
- `POST /api/chat/sessions/:id/reply` — Staff reply
- `PATCH /api/chat/sessions/:id/assign` — Gán staff
- `POST /api/bot/config` — Cấu hình bot
- `POST /api/bot/zalo/connect` — Kết nối Zalo (QR)
- `POST /api/bot/zalo/disconnect` — Ngắt Zalo

### 8.10 Public (không cần auth)
- `POST /api/chat/:tenant_slug` — Web widget gửi tin nhắn
- `GET /api/widget/:tenant_slug` — Widget embed script

### 8.11 System
- `GET /api/audit-log` — Nhật ký thay đổi
- `POST /api/upload` — Upload file
- `GET /api/settings` — Cài đặt hệ thống
