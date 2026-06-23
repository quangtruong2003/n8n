# Ghost Worker v3 Upgrade — Full Production Design

**Date:** 2026-06-23
**Status:** Approved
**Scope:** CS Bot Core (WF1) + Daily Report (WF2) + API Backend (WF3) + Owner Dashboard (FE)

---

## Overview

Upgrade WF 63394 (CS Bot) từ MVP sang production-ready, plus 2 workflow mới (Daily Report, API Backend) và Web Dashboard cho chủ spa.

**Business Goal:** Đủ robust để deploy cho khách hàng thật trong giai đoạn 8-30 ngày.

---

## Phase 1: CS Bot Core Upgrade (WF 63394)

### Section 1: PII Masking

**Node mới:** `Code - PII Masking` (sau Zalo Trigger, trước Read Bảng Giá)

**Flow:**
```
Zalo Trigger → [PII Masking] → Read Bảng Giá → Prepare Context → AI Agent
```

**Logic:**
- Regex bắt SĐT VN: `0[3|5|7|8|9]xxxxxxxx` → replace thành `[PHONE]`
- Regex bắt tên riêng (optional) → replace thành `[NAME]`
- Lưu mapping `masked ↔ real` trong variable nội bộ
- Sau khi AI trả lời → unhmask SĐT trong tin nhắn gửi khách
- JSON booking output KHÔNG bị mask (SĐT phải thật để lưu Sheet)

---

### Section 2: Multi-turn Smart Collection

**Node mới:** `Code - Smart Collection` (thay thế logic hiện tại trong Parse Booking)

**Flow:**
```
Parse Booking → [Smart Collection] → IF booking?
  ├─ YES → IF giờ làm việc? → [Check Duplicate] → Sheets + Confirm + Report
  └─ NO  → Detect Escalation?
            ├─ YES → [Prepare Escalation] → Zalo reply (SĐT spa)
            └─ NO  → Zalo reply thường
```

**Conversation UX — 4 Scenarios:**

**Scenario 1: Direct booking (ideal)**
```
Khách: Em muốn đặt lịch làm tóc sáng thứ 7
Bot:   Detect: service=làm tóc, time=sáng thứ 7, missing=name+phone
       Reply: "Dạ làm tóc sáng thứ 7 rất đẹp ạ! Em giữ slot cho chị nhé.
              Cho em xin tên chị để em lưu ạ! 💖"

Khách: Hương
Bot:   Detect: name=Hương, still missing=phone
       Reply: "Chị Hương rất thích ạ! Cho em xin số Zalo của chị
              để em xác nhận lịch nhé ạ! 📱"

Khách: 0912345678
Bot:   Detect: phone=0912345678 → ĐỦ → Inject booking JSON
       → Sheets + Confirm + Báo chủ
```

**Scenario 2: Price first (most common)**
```
Khách: Làm tóc bao nhiêu?
Bot:   Detect: intent=price, NOT booking
       Reply: "Dạ làm tóc bên em từ 200k-500k tùy kiểu ạ..."

Khách: Ừ book đi, em tên Hương, 0912345678
Bot:   Detect: DIRECT booking + name + phone → JSON booking
```

**Scenario 3: Scattered info**
```
Khách: Em muốn làm tóc
Bot:   "Dạ chị ơi! Em giữ slot cho chị nhé. Cho em xin tên ạ! 💖"

Khách: Thứ 7 được không?
Bot:   Detect: time=sáng thứ 7, KHÔNG có tên
       Reply: "Thứ 7 rất được ạ! Cho em xin tên chị nhé!"
       → KHÔNG hỏi lại thời gian

Khách: Hương
Bot:   "Chị Hương! Cho em xin số Zalo để em xác nhận lịch ạ! 📱"

Khách: 0912345678
Bot:   → ĐỦ → Booking!
```

**Scenario 4: Topic change (interrupt)**
```
Khách: Em muốn làm tóc
Bot:   "Dạ chị ơi! Em giữ slot cho chị nhé. Cho em xin tên ạ! 💖"

Khách: Nha khoa bên em mở cửa mấy giờ?
Bot:   Detect: KHÔNG phải reply tên → topic change → RESET pendingBooking
       Reply: "Dạ bên em mở cửa 8h-20h...
              Còn chị muốn làm tóc không ạ? 😊"
```

**Technical:**
- State lưu trong Memory (session): `pendingBooking = { missingFields, collectedData }`
- Priority order khi hỏi: `service → name → phone → time`
- Auto clear sau booking thành công hoặc 3 lượt không activity

---

### Section 3: Business Hours Detection

**Node mới:** `IF - Giờ làm việc?` (sau Smart Collection, trước处理 booking)

**Logic:**
```
IF giờ hiện tại >= 8:00 && <= 20:00 (timezone HCM)
  → TRUE: Xử lý booking + gửi notification chủ spa
  → FALSE:
      - Vẫn LƯU booking vào Sheet
      - KHÔNG gửi notification Zalo cho chủ spa
      - Reply: "Dạ em đã ghi nhận lịch của chị rồi ạ!
        Em sẽ xác nhận lại với chị vào sáng mai lúc 8h. 💖"
```

---

### Section 4: Escalation

**Khi nào trigger:**

| Tin nhắn khách | Action |
|---|---|
| "Gọi cho em" / "Cho số đt" | Gửi SĐT chủ spa + "Đây là số bên em ạ!" |
| "Nói chuyện với quản lý" | Alert chủ spa: "🔴 LEAD NÓNG" + reply khách |
| "Không tin bot" / "Nói chuyện người thật" | Gửi hotline + flag escalation |

---

### Section 5: Duplicate Booking Detection

**Node mới:** `Code - Check Duplicate` (sau Smart Collection)

**Logic:**
```
1. Search Google Sheet "DatCho" theo SĐT
2. Nếu tìm thấy:
   ├─ status === "Mới đặt" → UPDATE row (thời gian mới)
   │   → Reply: "Em đã cập nhật lịch cho chị rồi ạ!"
   ├─ status === "Đã xác nhận" → KHÔNG update
   │   → Reply: "Lịch đã xác nhận rồi ạ! Gọi trực tiếp để thay đổi."
   └─ status === "Hoàn thành" → TẠO BOOKING MỚI
3. Nếu KHÔNG tìm thấy → Tạo booking mới
```

---

## Phase 2: Daily Report (WF 2 — Mới)

### Flow
```
[Schedule Trigger: 8h00 sáng T2-CN]
  → [GS Read LogChat (hôm qua)]
  → [GS Read DatCho (hôm qua)]
  → [Code: Tính toán thống kê]
  → [Code: Format báo cáo]
  → [Zalo: Gửi báo cáo cho chủ spa]
```

### Report Format
```
📊 BÁO CÁO NGÀY 23/06/2026
━━━━━━━━━━━━━━━━━━━━━━

💬 Tin nhắn: 47
📅 Đặt lịch mới: 8
✅ Đã xác nhận: 5
⏳ Chưa xác nhận: 3
📈 Tỷ lệ chuyển đổi: 17.0%

🔥 Dịch vụ quan tâm nhất:
  1. Làm tóc (23 booking)
  2. Chăm sóc da (12 booking)

⚠️ Phàn nàn: 2 tin
🔔 Cần xác nhận: 3 booking

💡 Chúc spa một ngày hiệu quả! 💖
```

### Nodes (5)
1. Schedule Trigger (cron: 0 8 * * *)
2. Google Sheets - Read LogChat
3. Google Sheets - Read DatCho
4. Code - Tính toán thống kê
5. Zalo - Gửi báo cáo

---

## Phase 3: API Backend (WF 3 — Mới)

### Webhook Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhook/sync/{spa_id}` | CS Bot sync data |
| GET | `/webhook/api/{spa_id}/dashboard` | Dashboard data |
| GET | `/webhook/api/{spa_id}/customers` | Customers list (paginated) |
| GET | `/webhook/api/{spa_id}/bookings` | Bookings list (filterable) |
| POST | `/webhook/api/{spa_id}/bookings/{id}` | Update booking status |
| GET | `/webhook/api/{spa_id}/services` | Services list |
| POST | `/webhook/api/{spa_id}/services` | Create service |
| PUT | `/webhook/api/{spa_id}/services/{id}` | Update service |
| DELETE | `/webhook/api/{spa_id}/services/{id}` | Delete service |
| PUT | `/webhook/api/{spa_id}/config` | Update config |
| GET | `/webhook/api/{spa_id}/chat-logs` | Chat logs (paginated) |

### Dashboard API Response
```json
{
  "date": "2026-06-23",
  "totalMessages": 47,
  "totalBookings": 8,
  "pendingBookings": 3,
  "confirmedBookings": 5,
  "conversionRate": "17.0",
  "topServices": [
    { "name": "Làm tóc", "count": 23 },
    { "name": "Chăm sóc da", "count": 12 }
  ],
  "recentBookings": [
    { "name": "Hương", "service": "Làm tóc", "status": "Mới đặt", "time": "10:30" }
  ]
}
```

### Nodes (10)
1. Webhook POST sync
2. Code Validate + Parse
3. IF Type (booking vs chat_log)
4a. GS Append DatCho
4b. GS Append LogChat
5. Respond sync
6. Webhook GET dashboard
7. GS Read LogChat
8. GS Read DatCho
9. Code Dashboard calculation
10. Respond dashboard

---

## Phase 4: Owner Web Dashboard (FE)

### Tech Stack
- Next.js 14+ (App Router)
- Prisma ORM
- TailwindCSS + shadcn/ui
- TypeScript
- SQLite (local) / PostgreSQL (production)

### Database Schema (Prisma)
- Spa (1) → Branches (N)
- Spa (1) → Services (N)
- Spa (1) → Bookings (N)
- Spa (1) → ChatLogs (N)
- Spa (1) → Config (N)

### Pages
| Route | Purpose |
|-------|---------|
| `/login` | PIN code auth → JWT |
| `/dashboard` | Tổng quan real-time |
| `/customers` | Danh sách KH + search |
| `/bookings` | Quản lý đặt lịch (tabs by status) |
| `/pricing` | CRUD bảng giá |
| `/settings` | Cài đặt spa |
| `/chat-logs` | Lịch sử chat chi tiết |

### Multi-branch Support
- Mỗi spa có nhiều chi nhánh
- Chi nhánh = data trong Google Sheets (cột "Chi nhánh")
- Dashboard filter theo chi nhánh
- 1 WF xử lý tất cả chi nhánh (phân biệt bằng branch_id)

---

## Implementation Order

| Step | Phase | Task | Dependencies |
|------|-------|------|-------------|
| 1 | WF1 | PII Masking node | None |
| 2 | WF1 | Smart Collection node | None |
| 3 | WF1 | Business Hours IF node | None |
| 4 | WF1 | Escalation detection | Smart Collection |
| 5 | WF1 | Duplicate Check node | Smart Collection |
| 6 | WF2 | Daily Report workflow | None |
| 7 | WF3 | API Backend workflow | None |
| 8 | FE | Owner Dashboard (Next.js) | WF3 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| PII leakage to LLM | Regex masking before AI Agent |
| Duplicate bookings | Check Duplicate node before insert |
| Bot answers outside business hours | IF Giờ làm việc node |
| Escalation not handled | Detect + transfer to human |
| Data loss | Google Sheets backup + Log all chats |
| Dashboard downtime | WF3 independent from WF1 |
| Multi-branch confusion | Branch_id in all data tables |
