-- ============================================================
-- Universal Business Database Schema
-- Project: GHOST-WORKER
-- Database: Turso (SQLite-based)
-- Tables: 23
-- Idempotent: all statements use CREATE TABLE IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1. TENANT & ORGANIZATION LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS Tenant (
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

CREATE INDEX IF NOT EXISTS idx_tenant_slug ON Tenant(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_active ON Tenant(active);

-- ============================================================
-- 2. AUTH LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS User (
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

CREATE INDEX IF NOT EXISTS idx_user_tenant ON User(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_username ON User(username);

CREATE TABLE IF NOT EXISTS Session (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES User(id),
    token           TEXT NOT NULL UNIQUE,
    expires_at      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_token ON Session(token);
CREATE INDEX IF NOT EXISTS idx_session_user ON Session(user_id);

CREATE TABLE IF NOT EXISTS Role (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_role_tenant ON Role(tenant_id);

CREATE TABLE IF NOT EXISTS Permission (
    id              TEXT PRIMARY KEY,
    role_id         TEXT NOT NULL REFERENCES Role(id),
    resource        TEXT NOT NULL,
    can_view        INTEGER NOT NULL DEFAULT 0,
    can_create      INTEGER NOT NULL DEFAULT 0,
    can_edit        INTEGER NOT NULL DEFAULT 0,
    can_delete      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(role_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_permission_role ON Permission(role_id);

-- ============================================================
-- 3. BRANCH & USER-BRANCH
-- ============================================================

CREATE TABLE IF NOT EXISTS Branch (
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

CREATE INDEX IF NOT EXISTS idx_branch_tenant ON Branch(tenant_id);

CREATE TABLE IF NOT EXISTS UserBranch (
    user_id         TEXT NOT NULL REFERENCES User(id),
    branch_id       TEXT NOT NULL REFERENCES Branch(id),
    PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_userbranch_branch ON UserBranch(branch_id);

-- ============================================================
-- 4. PRODUCT & SERVICE LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS ProductCategory (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES Tenant(id),
    parent_id       TEXT REFERENCES ProductCategory(id),
    name            TEXT NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_category_tenant ON ProductCategory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_category_parent ON ProductCategory(parent_id);

CREATE TABLE IF NOT EXISTS Product (
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

CREATE INDEX IF NOT EXISTS idx_product_tenant ON Product(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_category ON Product(category_id);
CREATE INDEX IF NOT EXISTS idx_product_type ON Product(type);
CREATE INDEX IF NOT EXISTS idx_product_sku ON Product(tenant_id, sku);

CREATE TABLE IF NOT EXISTS ComboItem (
    id              TEXT PRIMARY KEY,
    combo_id        TEXT NOT NULL REFERENCES Product(id),
    product_id      TEXT NOT NULL REFERENCES Product(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    UNIQUE(combo_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_comboitem_combo ON ComboItem(combo_id);

-- ============================================================
-- 5. CUSTOMER LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS Customer (
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

CREATE INDEX IF NOT EXISTS idx_customer_tenant ON Customer(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_phone ON Customer(tenant_id, phone);

CREATE TABLE IF NOT EXISTS CustomerNote (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL REFERENCES Customer(id),
    user_id         TEXT NOT NULL REFERENCES User(id),
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customernote_customer ON CustomerNote(customer_id);

-- ============================================================
-- 6. ORDER & PAYMENT LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS "Order" (
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

CREATE INDEX IF NOT EXISTS idx_order_tenant ON "Order"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_branch ON "Order"(branch_id);
CREATE INDEX IF NOT EXISTS idx_order_customer ON "Order"(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_user ON "Order"(user_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_code ON "Order"(tenant_id, order_code);
CREATE INDEX IF NOT EXISTS idx_order_created ON "Order"(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS OrderItem (
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

CREATE INDEX IF NOT EXISTS idx_orderitem_order ON OrderItem(order_id);

CREATE TABLE IF NOT EXISTS Payment (
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

CREATE INDEX IF NOT EXISTS idx_payment_order ON Payment(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tenant ON Payment(tenant_id);

-- ============================================================
-- 7. BOOKING LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS Booking (
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

CREATE INDEX IF NOT EXISTS idx_booking_tenant ON Booking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_branch ON Booking(branch_id);
CREATE INDEX IF NOT EXISTS idx_booking_customer ON Booking(customer_id);
CREATE INDEX IF NOT EXISTS idx_booking_time ON Booking(branch_id, booking_start, booking_end);
CREATE INDEX IF NOT EXISTS idx_booking_status ON Booking(tenant_id, status);

CREATE TABLE IF NOT EXISTS BookingItem (
    id              TEXT PRIMARY KEY,
    booking_id      TEXT NOT NULL REFERENCES Booking(id),
    product_id      TEXT NOT NULL REFERENCES Product(id),
    staff_id        TEXT REFERENCES User(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    price           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookingitem_booking ON BookingItem(booking_id);

-- ============================================================
-- 8. CHAT & BOT LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS BotConfig (
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

CREATE INDEX IF NOT EXISTS idx_botconfig_tenant ON BotConfig(tenant_id);

CREATE TABLE IF NOT EXISTS ChatSession (
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

CREATE INDEX IF NOT EXISTS idx_chatsession_tenant ON ChatSession(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatsession_customer ON ChatSession(customer_id);
CREATE INDEX IF NOT EXISTS idx_chatsession_status ON ChatSession(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_chatsession_last ON ChatSession(tenant_id, last_message_at);

CREATE TABLE IF NOT EXISTS ChatMessage (
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

CREATE INDEX IF NOT EXISTS idx_chatmessage_session ON ChatMessage(session_id);
CREATE INDEX IF NOT EXISTS idx_chatmessage_tenant ON ChatMessage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatmessage_customer ON ChatMessage(customer_id);
CREATE INDEX IF NOT EXISTS idx_chatmessage_created ON ChatMessage(session_id, created_at);

-- ============================================================
-- 9. SYSTEM LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS Attachment (
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

CREATE INDEX IF NOT EXISTS idx_attachment_entity ON Attachment(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachment_tenant ON Attachment(tenant_id);

CREATE TABLE IF NOT EXISTS AuditLog (
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

CREATE INDEX IF NOT EXISTS idx_auditlog_tenant ON AuditLog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditlog_entity ON AuditLog(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_auditlog_created ON AuditLog(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auditlog_user ON AuditLog(user_id);

CREATE TABLE IF NOT EXISTS Setting (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT,
    key             TEXT NOT NULL,
    value           TEXT,
    description     TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_setting_tenant ON Setting(tenant_id);
CREATE INDEX IF NOT EXISTS idx_setting_key ON Setting(key);
