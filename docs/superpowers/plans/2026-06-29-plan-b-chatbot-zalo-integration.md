# Plan B: Chatbot & Zalo Integration

> **Spec:** `docs/superpowers/specs/2026-06-28-universal-database-design.md`
> **Scope:** Zalo Bot (zca-js), Web Widget, OpenRouter AI, ChatSession/ChatMessage management
> **Stack:** zca-js + OpenRouter API + Vanilla JS widget
> **Depends on:** Plan A (Database schema + Auth + Tenant APIs phải hoàn thành trước)

---

## Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS BACKEND                          │
│                                                             │
│  ┌───────────────┐        ┌───────────────┐                │
│  │  Zalo Bot     │        │  Web Widget   │                │
│  │  (zca-js)     │        │  (Chat API)   │                │
│  │               │        │               │                │
│  │  listener     │        │  POST         │                │
│  │  on("message")│        │  /api/chat/   │                │
│  │       │       │        │  {slug}       │                │
│  └───────┼───────┘        └───────┬───────┘                │
│          │                        │                        │
│          └──────────┬─────────────┘                        │
│                     ▼                                      │
│           ┌─────────────────┐                              │
│           │  Chat Service   │ ← Shared logic               │
│           │  (lib/chat/)    │                              │
│           └────────┬────────┘                              │
│                    ▼                                       │
│           ┌─────────────────┐     ┌─────────────────┐      │
│           │  OpenRouter     │────▶│  Turso DB       │      │
│           │  (AI Engine)    │     │  ChatSession    │      │
│           └─────────────────┘     │  ChatMessage    │      │
│                                   │  BotConfig      │      │
└───────────────────────────────────┴─────────────────┘──────┘

Web Widget = <script src="app.com/api/widget/{slug}"></script>
```

---

## Phase 1: OpenRouter AI Service

### Task 1.1 — OpenRouter client

**File:** `frontend/src/lib/chat/openrouter.ts`

```typescript
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletion {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
}

export async function chatCompletion(params: ChatCompletion): Promise<string>
```

**Logic:**
1. Gọi `POST https://openrouter.ai/api/v1/chat/completions`
2. Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `HTTP-Referer: app URL`
3. Body: `{ model, messages, max_tokens, temperature }`
4. Trả về `response.choices[0].message.content`

**Error handling:**
- Rate limit (429) → retry 1 lần sau 2s
- Timeout (30s) → trả fallback message
- API error → log + trả "Xin lỗi, tôi đang bận. Vui lòng thử lại."

**Verify:** Gọi OpenRouter với model `openai/gpt-4o-mini`, nhận response.

### Task 1.2 — Context builder

**File:** `frontend/src/lib/chat/context.ts`

Build system prompt + context cho AI dựa trên tenant data.

```typescript
export async function buildAIContext(tenantId: string): Promise<ChatMessage[]>
```

**Logic:**
1. Query BotConfig → lấy `ai_system_prompt`, `bot_name`
2. Query Product (active=1) → danh sách dịch vụ/sản phẩm + giá
3. Query Tenant → tên, giờ mở cửa, SĐT
4. Query Branch → danh sách chi nhánh + địa chỉ
5. Build messages array:
   ```
   [
     { role: 'system', content: ai_system_prompt },
     { role: 'system', content: 'Danh sách dịch vụ: ...' },
     { role: 'system', content: 'Giờ mở cửa: ...' },
     { role: 'system', content: 'Chi nhánh: ...' }
   ]
   ```

**Verify:** Build context cho demo tenant, kiểm tra output chứa đủ thông tin.

### Task 1.3 — Chat orchestrator

**File:** `frontend/src/lib/chat/chat-service.ts`

Logic xử lý tin nhắn chung cho cả 2 kênh (Zalo + Web).

```typescript
export async function processMessage(params: {
  tenantId: string
  sessionId: string
  customerId?: string
  channel: 'zalo' | 'web'
  userMessage: string
}): Promise<{
  reply: string
  shouldHandoffToStaff: boolean
}>
```

**Logic:**
1. Lấy BotConfig cho tenant
2. Kiểm tra `ai_enabled` — nếu 0 → trả "Nhân viên sẽ phản hồi sớm"
3. Kiểm tra `working_hours_only` — nếu 1 và ngoài giờ → trả message giờ làm việc
4. Lấy lịch sử chat (10 tin nhắn gần nhất trong session) cho context
5. Build AI context (Task 1.2)
6. Append user message
7. Gọi OpenRouter (Task 1.1)
8. Lưu ChatMessage (sender=customer) vào DB
9. Lưu ChatMessage (sender=bot) vào DB
10. Update ChatSession.last_message_at
11. Kiểm tra intent: nếu khách muốn nói chuyện với người thật → `shouldHandoffToStaff = true`

**Intent detection (đơn giản):**
- Regex check: "nói chuyện với người", "gọi nhân viên", "không muốn chat với bot"
- Nếu detect → đổi ChatSession.status = 'active' (chờ staff)

**Verify:** Gửi tin nhắn qua service, nhận reply từ AI, kiểm tra DB có 2 ChatMessage mới.

---

## Phase 2: Web Widget

### Task 2.1 — Chat API endpoint (public)

**File:** `frontend/src/app/api/chat/[slug]/route.ts`

**POST /api/chat/{slug}**

Không cần auth (public endpoint cho widget).

**Body:**
```json
{
  "message": "Xin chào, spa có dịch vụ gì?",
  "session_id": "uuid-optional"  // null = tạo session mới
}
```

**Logic:**
1. Tìm Tenant theo `slug`
2. Nếu không tìm thấy → 404
3. Nếu tenant `active = 0` → 403
4. Tìm/tạo ChatSession:
   - Nếu có `session_id` → tìm session hiện có
   - Nếu không → tạo mới (channel=web, status=bot_handling)
5. Tìm/tạo Customer dựa trên session (anonymous cho web)
6. Gọi `processMessage()` (Task 1.3)
7. Trả về:
```json
{
  "reply": "Xin chào! Spa Quang Truong có các dịch vụ...",
  "session_id": "uuid",
  "bot_name": "Trợ lý ảo"
}
```

**Rate limit:** 30 requests/phút per IP

**Verify:** POST với slug đúng, slug sai, message rỗng.

### Task 2.2 — Chat history API (public)

**File:** `frontend/src/app/api/chat/[slug]/sessions/[sessionId]/route.ts`

**GET /api/chat/{slug}/sessions/{sessionId}**

Lấy lịch sử tin nhắn cho session.

**Logic:**
1. Validate tenant slug + session_id
2. Query ChatMessage theo session_id, ORDER BY created_at ASC
3. Trả array tin nhắn

**Verify:** Lấy lịch sử session có tin nhắn, session không tồn tại.

### Task 2.3 — Widget embed script

**File:** `frontend/src/app/api/widget/[slug]/route.ts`

**GET /api/widget/{slug}**

Trả về JavaScript tạo floating chat widget.

**Content-Type:** `application/javascript`

**Script functionality:**
1. Tạo floating button góc phải màn hình (tuỳ theo theme config)
2. Click button → mở chat box
3. Chat box có: header (tên bot), message list, input box
4. Gửi tin nhắn → POST `/api/chat/{slug}`
5. Hiển thị reply
6. Lưu session_id trong localStorage
7. Khi mở lại → load lịch sử từ GET `/api/chat/{slug}/sessions/{sessionId}`

**Styling:**
- Inline CSS (không cần external file)
- Responsive (mobile-friendly)
- Tuỳ chỉnh màu sắc từ `web_widget_theme`
- Font: system font stack

**Verify:** Nhúng script vào HTML test, mở widget, gửi tin nhắn.

### Task 2.4 — Widget session management

**Logic trong widget script:**
- Lần đầu mở: tạo session_id mới (crypto.randomUUID)
- Lưu vào `localStorage` key: `gw_chat_{slug}_session`
- Mỗi lần mở: lấy session_id từ localStorage
- Khi session quá cũ (> 24h không hoạt động): tạo session mới

---

## Phase 3: Zalo Bot (zca-js)

### Task 3.1 — Zalo service

**File:** `frontend/src/lib/chat/zalo.ts`

Quản lý kết nối Zalo qua zca-js.

```typescript
import { Zalo, ThreadType } from 'zca-js'

// Singleton map: tenantId → zalo instance
const zaloInstances: Map<string, { api: any; zalo: Zalo }> = new Map()

export async function connectZalo(tenantId: string, cookies: object, imei: string, userAgent: string): Promise<boolean>
export function disconnectZalo(tenantId: string): void
export function getZaloStatus(tenantId: string): { connected: boolean; accountName?: string }
export async function sendZaloMessage(tenantId: string, threadId: string, message: string, type: ThreadType): Promise<boolean>
```

**connectZalo logic:**
1. Tạo instance `new Zalo()`
2. Login bằng cookies đã lưu: `zalo.loginViaCookies(cookies, imei, userAgent)`
3. Nếu login thành công:
   - Lưu vào `zaloInstances` map
   - Update BotConfig: `zalo_connected = 1`, `zalo_account_name = ...`
   - Start listener
4. Nếu login thất bại:
   - Update BotConfig: `zalo_connected = 0`
   - Return false

**Listener logic (khi nhận message):**
```typescript
api.listener.on('message', async (message) => {
  if (message.isSelf) return
  if (typeof message.data.content !== 'string') return

  switch (message.type) {
    case ThreadType.User:
      await handleZaloMessage(tenantId, message)
      break
    case ThreadType.Group:
      // Bỏ qua group chat cho MVP
      break
  }
})
```

**handleZaloMessage logic:**
1. Tìm/tạo Customer dựa trên Zalo threadId (metadata.zalo_thread_id)
2. Tìm/tạo ChatSession (channel=zalo, metadata.zalo_thread_id)
3. Gọi `processMessage()` (Task 1.3)
4. Nếu reply trả về → gửi qua `api.sendMessage({ msg: reply }, threadId, ThreadType.User)`

**Verify:** Mock zca-js, test connect/disconnect/message flow.

### Task 3.2 — Zalo connection API

**File:** `frontend/src/app/api/bot/zalo/route.ts`

**POST /api/bot/zalo/connect**
- Body: `{ cookies, imei, user_agent }`
- Auth: withAuth (owner only)
- Logic:
  1. Validate cookies format
  2. Mã hoá cookies bằng AES-256 trước khi lưu
  3. Update BotConfig
  4. Gọi `connectZalo()`
  5. Trả status

**POST /api/bot/zalo/disconnect**
- Auth: withAuth (owner only)
- Logic:
  1. Gọi `disconnectZalo()`
  2. Update BotConfig: `zalo_connected = 0`, clear cookies
  3. Trả status

**GET /api/bot/zalo/status**
- Auth: withAuth
- Logic: trả `zalo_connected`, `zalo_account_name`

**Verify:** Connect Zalo, check status, disconnect.

### Task 3.3 — Cookie encryption helper

**File:** `frontend/src/lib/chat/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SECRET = process.env.ZALO_COOKIE_SECRET || process.env.JWT_SECRET || 'fallback-secret'

export function encrypt(text: string): string   // returns base64(nonce + tag + ciphertext)
export function decrypt(encrypted: string): string
```

**Verify:** Encrypt → decrypt round-trip.

### Task 3.4 — Zalo auto-reconnect on startup

**File:** `frontend/src/lib/chat/zalo-init.ts`

Khi Next.js server khởi động, tự động reconnect tất cả tenants có `zalo_connected = 1`.

```typescript
export async function initAllZaloConnections(): Promise<void>
```

**Logic:**
1. Query BotConfig WHERE `zalo_connected = 1`
2. Với mỗi tenant:
   - Decrypt cookies
   - Gọi `connectZalo()`
   - Nếu fail → log warning, update `zalo_connected = 0`
3. Log tổng kết: "Zalo: X/Y tenants connected"

**Gọi từ:** `frontend/src/lib/startup.ts` hoặc Next.js instrumentation hook

**Verify:** Restart server, kiểm tra Zalo tự reconnect.

---

## Phase 4: Chat Dashboard APIs (Staff)

### Task 4.1 — ChatSession list API

**File:** `frontend/src/app/api/chat/sessions/route.ts`

**GET /api/chat/sessions**
- Auth: withAuth (owner/staff có permission `chat.view`)
- Query params: `?status=bot_handling|active|staff_handling|resolved&page=1&limit=20`
- Trả: danh sách sessions + customer info + last message preview

**Verify:** Lấy danh sách sessions, filter theo status.

### Task 4.2 — ChatMessage list API

**File:** `frontend/src/app/api/chat/sessions/[id]/messages/route.ts`

**GET /api/chat/sessions/{id}/messages**
- Auth: withAuth
- Trả: tất cả messages trong session, ORDER BY created_at ASC

**Verify:** Lấy messages cho session có nhiều tin nhắn.

### Task 4.3 — Staff reply API

**File:** `frontend/src/app/api/chat/sessions/[id]/reply/route.ts`

**POST /api/chat/sessions/{id}/reply**
- Auth: withAuth (staff có permission `chat.create`)
- Body: `{ content: "..." }`
- Logic:
  1. Validate session tồn tại + thuộc tenant
  2. Insert ChatMessage (sender=staff)
  3. Update session: `status = staff_handling`, `assigned_staff_id`
  4. Nếu session.channel = 'zalo' → gửi reply qua Zalo
  5. Trả message đã tạo

**Verify:** Staff reply qua dashboard, kiểm tra Zalo nhận được.

### Task 4.4 — Session assign/resolve API

**File:** `frontend/src/app/api/chat/sessions/[id]/assign/route.ts`

**PATCH /api/chat/sessions/{id}/assign**
- Body: `{ staff_id: "...", action: "assign" | "resolve" }`
- Logic:
  - assign: update `assigned_staff_id`, `status = staff_handling`
  - resolve: update `status = resolved`

**Verify:** Gán staff, kết thúc session.

---

## Phase 5: Web → Zalo Handoff

### Task 5.1 — Phone detection trong chat

**Logic trong `processMessage()` (Task 1.3):**

Khi khách gửi tin nhắn chứa SĐT (regex: `/(0|\+84)\d{9,10}/`):
1. Extract SĐT
2. Tìm Customer có phone đó trong tenant
3. Nếu tìm thấy → đổi session sang channel Zalo:
   ```
   reply: "Đã tìm thấy Zalo của bạn. Vui lòng qua Zalo để tiếp tục 
   đặt lịch và nhận thông báo nhé! 🎉"
   ```
4. Lưu SĐT vào ChatSession.metadata.customer_phone

**Verify:** Khách gửi SĐT trong web chat, bot trả lời hướng dẫn qua Zalo.

### Task 5.2 — Context transfer

Khi khách từ web sang Zalo:
1. Bot Zalo nhận tin nhắn đầu tiên từ khách
2. Tìm ChatSession trên web gần nhất có cùng customer
3. Lấy context (đã hỏi gì, quan tâm dịch vụ gì)
4. Inject vào AI context: "Khách đã hỏi về [dịch vụ X] trên web"

**Verify:** Khách chat web → qua Zalo, bot Zalo biết context trước đó.

---

## Phase 6: Integration & Cleanup

### Task 6.1 — Remove n8n dependencies

- Xoá `frontend/src/app/api/n8n/route.ts` (đã có trong Plan A)
- Giữ `n8n/workflows/` cho đến khi Zalo bot hoạt động ổn định
- Update `.env.local`: thêm `OPENROUTER_API_KEY`, `ZALO_COOKIE_SECRET`

### Task 6.2 — Update BotConfig APIs

**File:** `frontend/src/app/api/bot/config/route.ts`

**GET /api/bot/config**
- Auth: withAuth (owner)
- Trả: BotConfig (ẩn zalo_cookies, chỉ hiện zalo_connected + zalo_account_name)

**PUT /api/bot/config**
- Auth: withAuth (owner)
- Body: `{ bot_name, greeting, ai_enabled, ai_model, ai_system_prompt, working_hours_only, web_widget_theme }`
- Logic: update BotConfig

**Verify:** Cập nhật bot name, system prompt.

### Task 6.3 — Widget theme customization

Owner có thể tuỳ chỉnh widget qua admin:
- `primaryColor` — màu chính
- `position` — `bottom-right` | `bottom-left`
- `greeting` — lời chào mở đầu

**Verify:** Đổi theme, reload widget, thấy thay đổi.

---

## Task Dependency Graph

```
Phase 1 (OpenRouter AI)
    │
    ├── Task 1.1 (OpenRouter client) ──┐
    ├── Task 1.2 (Context builder) ────┤
    └── Task 1.3 (Chat service) ◄──────┘  (cần 1.1 + 1.2)
            │
            ▼
    ┌───────┴───────┐
    │               │
Phase 2          Phase 3
(Web Widget)     (Zalo Bot)
    │               │
    ├── 2.1 ◄───────┤  (cần 1.3)
    ├── 2.2         ├── 3.1 ◄── (cần 1.3)
    ├── 2.3         ├── 3.2
    └── 2.4         ├── 3.3
                    └── 3.4
            │               │
            ▼               ▼
Phase 4 (Chat Dashboard) ← cần Phase 2 + Phase 3
    │
    ├── 4.1 (Session list)
    ├── 4.2 (Message list)
    ├── 4.3 (Staff reply) ← cần 3.1 (gửi Zalo)
    └── 4.4 (Assign/resolve)

Phase 5 (Web → Zalo Handoff) ← cần Phase 2 + Phase 3
    │
    ├── 5.1 (Phone detection)
    └── 5.2 (Context transfer)

Phase 6 (Cleanup) ← cuối cùng
```

---

## Parallel Execution Opportunities

**Có thể chạy song song:**
- Phase 2 (Web Widget) ∥ Phase 3 (Zalo Bot) — cả 2 phụ thuộc Phase 1
- Task 2.1 ∥ Task 2.3 — API endpoint ∥ Widget script
- Task 3.1 ∥ Task 3.3 — Zalo service ∥ Crypto helper
- Phase 4 ∥ Phase 5 — Dashboard ∥ Handoff logic

---

## Verify Checklist (cuối Plan B)

### OpenRouter
- [ ] Gọi OpenRouter API thành công với model `openai/gpt-4o-mini`
- [ ] Context builder tạo prompt đúng (có danh sách dịch vụ, giờ mở cửa)
- [ ] Xử lý lỗi API (timeout, rate limit) hoạt động

### Web Widget
- [ ] Widget script nhúng vào HTML test → hiển thị floating button
- [ ] Click button → mở chat box
- [ ] Gửi tin nhắn → nhận reply từ AI
- [ ] Session persist qua localStorage
- [ ] Load lịch sử khi mở lại widget

### Zalo Bot
- [ ] Kết nối Zalo qua cookies → thành công
- [ ] Nhận tin nhắn Zalo → AI reply
- [ ] Gửi reply về Zalo thành công
- [ ] Cookies mã hoá trước khi lưu DB
- [ ] Auto-reconnect khi server restart
- [ ] Disconnect → status update đúng

### Chat Dashboard
- [ ] Danh sách sessions hiển thị đúng
- [ ] Xem chi tiết tin nhắn trong session
- [ ] Staff reply → tin nhắn đến Zalo
- [ ] Gán staff / kết thúc session hoạt động

### Web → Zalo Handoff
- [ ] Khách gửi SĐT trong web chat → bot hướng dẫn qua Zalo
- [ ] Context từ web được transfer sang Zalo session

### Security
- [ ] Public endpoints có rate limit
- [ ] Không leak tenant data qua widget
- [ ] Zalo cookies mã hoá trong DB
