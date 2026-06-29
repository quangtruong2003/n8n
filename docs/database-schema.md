# GHOST-WORKER Database Schema

## Overview

Database: **Turso** (SQLite-based, distributed)
- URL: `libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io`
- Auth Token: stored in `TURSO_AUTH_TOKEN` env variable

---

## Tables

### 1. Spa (Spa/Doanh nghiệp)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID, e.g., `spa_demo_001` |
| `name` | TEXT | Tên Spa |
| `pin` | TEXT | PIN đăng nhập (plaintext hoặc `salt:hash`) |
| `phone` | TEXT | SĐT liên hệ |
| `openTime` | TEXT | Giờ mở cửa, e.g., `08:00` |
| `closeTime` | TEXT | Giờ đóng cửa, e.g., `22:00` |
| `botActive` | INTEGER | 1 = active, 0 = inactive |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 2. SpaConfig (Cấu hình Bot)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `spaId` | TEXT (FK) | Liên kết đến Spa |
| `botGreeting` | TEXT | Lời chào bot |
| `botName` | TEXT | Tên bot |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 3. Branch (Chi nhánh)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID, e.g., `branch_001` |
| `spaId` | TEXT (FK) | Liên kết đến Spa |
| `name` | TEXT | Tên chi nhánh |
| `address` | TEXT | Địa chỉ |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 4. Service (Dịch vụ)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID, e.g., `svc_001` |
| `spaId` | TEXT (FK) | Liên kết đến Spa |
| `name` | TEXT | Tên dịch vụ |
| `price` | INTEGER | Giá (VND) |
| `duration` | INTEGER | Thời gian (phút) |
| `description` | TEXT | Mô tả |
| `active` | INTEGER | 1 = active, 0 = inactive |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 5. Customer (Khách hàng)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `spaId` | TEXT (FK) | Liên kết đến Spa |
| `name` | TEXT | Tên (đã mask: `[NAME]`) |
| `phone` | TEXT | SĐT |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 6. Booking (Đặt lịch)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `spaId` | TEXT (FK) | Liên kết đến Spa |
| `customerId` | TEXT (FK) | Liên kết đến Customer |
| `serviceId` | TEXT (FK) | Liên kết đến Service |
| `branchId` | TEXT (FK) | Liên kết đến Branch (nullable) |
| `status` | TEXT | `pending`, `confirmed`, `completed`, `cancelled` |
| `bookingTime` | TEXT | Thời gian đặt (ISO timestamp) |
| `note` | TEXT | Ghi chú |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 7. ChatLog (Nhật ký chat)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `spaId` | TEXT (FK) | Liên kết đến Spa |
| `customerId` | TEXT (FK) | Liên kết đến Customer |
| `branchId` | TEXT (FK) | Liên kết đến Branch (nullable) |
| `sender` | TEXT | `user` hoặc `bot` |
| `content` | TEXT | Nội dung tin nhắn |
| `sessionId` | TEXT | Session ID cho cuộc trò chuyện |
| `createdAt` | TEXT | ISO timestamp |

---

## PII Masking Rules

Theo luật bảo mật dữ liệu Việt Nam 2026:

| Dữ liệu thật | Masked thành |
|---------------|---------------|
| Tên khách hàng | `[NAME]` |
| SĐT khách hàng | Giữ nguyên (cần thiết cho booking) |
| Địa chỉ | `[ADDRESS]` |

**Chỉ giải mã (decode) khi khách đồng ý đặt lịch.**

---

## API Endpoints

### Auth
- `POST /api/auth/login` - Đăng nhập bằng PIN
- `DELETE /api/auth/login` - Đăng xuất
- `GET /api/auth/me` - Lấy thông tin spa hiện tại

### Spa Data (requires auth)
- `GET /api/spa/[id]/dashboard` - Dashboard stats
- `GET /api/spa/[id]/services` - Danh sách dịch vụ
- `POST /api/spa/[id]/services` - Tạo dịch vụ
- `PUT /api/spa/[id]/services/[serviceId]` - Cập nhật dịch vụ
- `DELETE /api/spa/[id]/services/[serviceId]` - Xóa dịch vụ
- `GET /api/spa/[id]/branches` - Danh sách chi nhánh
- `GET /api/spa/[id]/customers` - Danh sách khách hàng
- `GET /api/spa/[id]/bookings` - Danh sách booking
- `PATCH /api/spa/[id]/bookings` - Cập nhật booking status
- `GET /api/spa/[id]/chat-logs` - Nhật ký chat
- `GET /api/spa/[id]/config` - Cấu hình bot
- `PUT /api/spa/[id]/config` - Cập nhật cấu hình

### n8n Webhook (requires API key)
- `POST /api/n8n` - Webhook cho n8n workflow
  - Actions: `create_customer`, `create_booking`, `log_chat`, `get_services`, `get_config`, `get_branches`

---

## Sample Data

### Spa
```json
{
  "id": "spa_demo_001",
  "name": "Spa Quang Truong Demo",
  "pin": "1234",
  "phone": "0909123456",
  "openTime": "08:00",
  "closeTime": "22:00",
  "botActive": 1
}
```

### Services
```json
[
  { "id": "svc_001", "name": "Massage Body", "price": 350000, "duration": 60 },
  { "id": "svc_002", "name": "Massage Foot", "price": 200000, "duration": 45 },
  { "id": "svc_003", "name": "Facial", "price": 450000, "duration": 90 },
  { "id": "svc_004", "name": "Combo VIP", "price": 800000, "duration": 120 }
]
```

---

## Environment Variables

```env
# Turso Database
DATABASE_URL=libsql://spa-quangtruong2003.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=<your-token>

# Auth
JWT_SECRET=<your-secret>

# n8n Integration
N8N_API_KEY=ghost-worker-n8n-secret
```
