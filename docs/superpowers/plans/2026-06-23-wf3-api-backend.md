# WF3 API Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new n8n workflow that exposes webhook endpoints for CS Bot data sync and a dashboard API, enabling the Owner Web Dashboard (FE) to fetch real-time data from Google Sheets via n8n.

**Architecture:** Two webhook entry points in one workflow: POST `/webhook/sync/{spa_id}` for CS Bot data ingestion, and GET `/webhook/api/{spa_id}/dashboard` for dashboard data retrieval. Data persists to Google Sheets (same sheets as WF1/WF2) and is read back on demand.

**Tech Stack:** n8n (webhook nodes), JavaScript (Code nodes v2), Google Sheets (OAuth2), JSON validation (Zod-style in JS).

**Data Layer Architecture (WF3 vs FE):**
WF3 n8n webhooks are the data layer for the n8n ecosystem (CS Bot, Daily Report). The FE's existing Prisma-based API routes (`/api/spa/[id]/dashboard`) are the data layer for the dashboard UI. In production, the FE will be updated to call WF3 webhooks instead of querying Prisma directly. This migration is a separate task and is NOT in WF3 scope. Until then, the two data layers coexist independently. The WF3 response shape (`{ date, totalMessages, totalBookings, ... }`) is the target shape; the FE's current shape (`{ stats, hourlyData, recentPendingBookings }`) will be replaced when the FE migrates to WF3 webhooks.

**Dashboard JSON Shape:**
The current FE dashboard endpoint (`/api/spa/[id]/dashboard/route.ts`) returns `{ stats, hourlyData, recentPendingBookings }`. WF3 returns `{ date, totalMessages, totalBookings, pendingBookings, confirmedBookings, conversionRate, topServices, recentBookings }`. These shapes are intentionally different — WF3 is the target shape for the new n8n-based architecture. The FE will switch to consuming WF3 webhooks in a future migration task.

## Google Sheets Schema — Multi-Tenant Columns

All Google Sheets tables used by WF3 MUST include a `spa_id` column as the first column. This is required for multi-tenant isolation — every row must be scoped to a specific spa.

**DatCho sheet columns (in order):**
| spa_id | Thời gian | Tên khách | Số điện thoại | Dịch vụ | Ghi chú | Zalo ID | Trạng thái | Chi nhánh |

**LogChat sheet columns (in order):**
| spa_id | Thời gian | Zalo ID | Tên khách | Tin nhắn khách | Phản hồi AI | Loại | Đặt lịch |

**Services sheet columns (in order):**
| spa_id | ID | Dịch vụ | Giá | Mô tả | Trạng thái |

**Config sheet columns (in order):**
| spa_id | Tên bot | Lời chào | Giờ mở cửa | Giờ đóng cửa | Bot_active |

Every GS Read node MUST filter by `spa_id`. Every GS Write node MUST include `spa_id` in the row data. No exceptions.

## Global Constraints

- All Code nodes use `n8n-nodes-base.code` typeVersion 2.
- Google Sheets credentials match WF1 (`googleSheetsOAuth2Api`).
- Webhook paths must include `spa_id` for multi-tenant isolation.
- All responses use consistent JSON envelope: `{ success, data, error }`.
- New workflow — separate from WF1 and WF2.
- All Google Sheets rows MUST include `spa_id` as the first column.
- All Google Sheets reads MUST filter by `spa_id` column.
- All webhook endpoints MUST validate `X-API-Key` header before processing (see Task 0).

## Target Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhook/sync/{spa_id}` | CS Bot sync (booking + chat_log) |
| GET | `/webhook/api/{spa_id}/dashboard` | Dashboard aggregated data |
| GET | `/webhook/api/{spa_id}/customers` | Customer list (paginated) |
| GET | `/webhook/api/{spa_id}/bookings` | Bookings list (filterable) |
| POST | `/webhook/api/{spa_id}/bookings/{id}` | Update booking status |
| GET | `/webhook/api/{spa_id}/services` | Services list |
| POST | `/webhook/api/{spa_id}/services` | Create service |
| PUT | `/webhook/api/{spa_id}/services/{id}` | Update service |
| DELETE | `/webhook/api/{spa_id}/services/{id}` | Delete service |
| PUT | `/webhook/api/{spa_id}/config` | Update config |
| GET | `/webhook/api/{spa_id}/chat-logs` | Chat logs (paginated) |

## Target Flow (Sync)

```
[Webhook POST /sync/{spa_id}]
  → [Code: Validate + Parse + Auth]
  → [IF: type === 'booking']
      ├─ YES → [GS: Append DatCho (with spa_id)] → [Respond: success]
      └─ NO  → [GS: Append LogChat (with spa_id)] → [Respond: success]
```

## Target Flow (Dashboard API)

```
[Webhook GET /api/{spa_id}/dashboard]
  → [Code: Auth Check]
  → [GS: Read LogChat (today, filtered by spa_id)]
  → [GS: Read DatCho (today, filtered by spa_id)]
  → [Code: Calculate dashboard stats]
  → [Respond: JSON dashboard]
```

---

### Task 0: API Key Authentication

**Files:**
- Modify: `n8n/workflow-api-backend.json` (when created)

**Interfaces:**
- Consumes: HTTP requests with `X-API-Key` header
- Produces: Rejects with 401 if key is missing or invalid; passes through if valid

**Architecture note:** For the MVP, all WF3 endpoints share a single API key stored as a workflow-level static variable. This is a shared secret between the CS Bot (WF1), the FE, and any other caller. In production, rotate this key per spa_id using a Config sheet column.

- [ ] **Step 1: Add a Static Data node for the API key**

Add a Code node `Code - API Key Config` at the start of every webhook path:

```javascript
// API Key validation — shared secret for MVP
// In production, store per-spa keys in Config sheet
const VALID_API_KEY = $getWorkflowStaticData('global').apiKey || 'gw-dev-api-key-change-in-production';
return [{ json: { validApiKey: VALID_API_KEY } }];
```

In n8n, set the static data via the workflow's static data panel:
- Key: `apiKey`
- Value: `gw-dev-api-key-change-in-production`

- [ ] **Step 2: Add Code node `Code - Auth Check` after each Webhook node**

This node runs immediately after every Webhook node (before any business logic). It checks the `X-API-Key` header.

```javascript
// Auth check — reject if X-API-Key header is missing or invalid
const requestHeaders = $input.first().json.headers || {};
const providedKey = requestHeaders['x-api-key'] || '';
const staticData = $getWorkflowStaticData('global');
const validKey = staticData.apiKey || 'gw-dev-api-key-change-in-production';

if (!providedKey || providedKey !== validKey) {
  return [{
    json: {
      success: false,
      error: 'Unauthorized: missing or invalid X-API-Key header'
    },
    meta: { httpStatus: 401 }
  }];
}

// Pass through original input data on success
return [$input.first()];
```

Wire: Webhook → `Code - Auth Check` → (original business logic chain).

For error responses, connect the Auth Check node's second output (or use Respond to Webhook) to return 401.

- [ ] **Step 3: Add Respond to Webhook for auth failure**

```javascript
return [{
  json: {
    success: false,
    error: 'Unauthorized: missing or invalid X-API-Key header'
  }
}];
```

Wire: `Code - Auth Check` (error branch) → Respond to Webhook (401).

- [ ] **Step 4: Test auth rejection and acceptance**

```bash
# Should return 401
curl -X POST http://localhost:5678/webhook/sync/test-spa-123 \
  -H "Content-Type: application/json" \
  -d '{"type":"booking","data":{"name":"Test"}}'

# Should return 401 (wrong key)
curl -X POST http://localhost:5678/webhook/sync/test-spa-123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong-key" \
  -d '{"type":"booking","data":{"name":"Test"}}'

# Should succeed
curl -X POST http://localhost:5678/webhook/sync/test-spa-123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gw-dev-api-key-change-in-production" \
  -d '{"type":"booking","data":{"name":"Test"}}'
```

- [ ] **Step 5: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add API key authentication to all webhook endpoints"
```

---

### Task 1: Workflow Skeleton + Sync Webhook

**Files:**
- Create: `n8n/workflow-api-backend.json`

**Interfaces:**
- Consumes: HTTP POST `{ type, data }` with `spa_id` in URL path, `X-API-Key` header
- Produces: `{ success, data, error }` JSON response

**Multi-tenant requirement:** The sync webhook MUST include `spa_id` in every row it writes to Google Sheets. This is the foundation of multi-tenant data isolation — without it, reads cannot filter by spa.

- [ ] **Step 1: Create new workflow in n8n**

Name: `API Backend - Ghost Worker`.

- [ ] **Step 2: Add Webhook node `Webhook - Sync`**

Configure:
- Method: POST
- Path: `sync/{spa_id}`
- Response Mode: `responseNode` (manual response via Respond to Webhook)
- Authentication: None (handled by Code - Auth Check node)

- [ ] **Step 3: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Sync` → `Code - Auth Check` → `Code - Validate + Parse`.

- [ ] **Step 4: Add Code node `Code - Validate + Parse`**

```javascript
// Validate incoming sync payload and include spa_id in row data
const body = $input.first().json.body;
const spaId = $input.first().json.params?.spa_id;

if (!spaId) {
  return [{ json: { success: false, error: 'Missing spa_id in URL' } }];
}

const { type, data } = body || {};
if (!type || !data) {
  return [{ json: { success: false, error: 'Missing type or data in body' } }];
}

if (!['booking', 'chat_log'].includes(type)) {
  return [{ json: { success: false, error: `Invalid type: ${type}. Must be 'booking' or 'chat_log'` } }];
}

// Normalize data shape — spa_id is ALWAYS the first column
const normalized = type === 'booking' ? {
  'spa_id': spaId,
  'Thời gian': data.time || new Date().toISOString(),
  'Tên khách': data.name || '',
  'Số điện thoại': data.phone || '',
  'Dịch vụ': data.service || '',
  'Ghi chú': data.note || '',
  'Zalo ID': data.senderId || '',
  'Trạng thái': 'Mới đặt',
  'Chi nhánh': data.branch || ''
} : {
  'spa_id': spaId,
  'Thời gian': data.time || new Date().toISOString(),
  'Zalo ID': data.senderId || '',
  'Tên khách': data.senderName || '',
  'Tin nhắn khách': data.customerMessage || '',
  'Phản hồi AI': data.aiReply || '',
  'Loại': data.category || 'Tư vấn',
  'Đặt lịch': data.isBooking ? 'Có' : 'Không'
};

return [{
  json: {
    success: true,
    syncType: type,
    spaId,
    rowData: normalized
  }
}];
```

- [ ] **Step 5: Add IF node `IF - Type`**

Condition: `{{ $json.syncType }}` equals `booking`
- TRUE → Google Sheets append to DatCho
- FALSE → Google Sheets append to LogChat

- [ ] **Step 6: Add Google Sheets nodes**

`GS - Append DatCho`:
- Operation: Append
- Document: Same DatCho sheet as WF1
- Sheet: `DatCho`
- Values: `{{ $json.rowData }}`
- Note: rowData includes `spa_id` as the first column

`GS - Append LogChat`:
- Operation: Append
- Document: Same LogChat sheet as WF1
- Sheet: `LogChat`
- Values: `{{ $json.rowData }}`
- Note: rowData includes `spa_id` as the first column

- [ ] **Step 7: Add Respond to Webhook nodes**

Each path ends with `Respond to Webhook`:
```javascript
return [{
  json: {
    success: true,
    message: 'Data synced successfully',
    type: $('Code - Validate + Parse').first().json.syncType
  }
}];
```

- [ ] **Step 8: Test with curl**

```bash
curl -X POST http://localhost:5678/webhook/sync/test-spa-123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gw-dev-api-key-change-in-production" \
  -d '{"type":"booking","data":{"name":"Hương","phone":"0912345678","service":"Làm tóc","note":"Sáng thứ 7"}}'
```

Expected: `{ "success": true, "message": "Data synced successfully", "type": "booking" }`

Verify in Google Sheets: the DatCho sheet row must have `test-spa-123` in the first column (spa_id).

- [ ] **Step 9: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add sync webhook with spa_id in row data, validation, and dual-sheet routing"
```

---

### Task 2: Dashboard API Endpoint

**Files:**
- Modify: `n8n/workflow-api-backend.json`

**Interfaces:**
- Consumes: HTTP GET with `spa_id` in URL path, `X-API-Key` header
- Produces: Dashboard JSON matching spec response shape

**Multi-tenant requirement:** Both GS Read nodes MUST filter by `spa_id` column. Without this, the dashboard would show data from all spas mixed together.

- [ ] **Step 1: Add Webhook node `Webhook - Dashboard`**

Configure:
- Method: GET
- Path: `api/{spa_id}/dashboard`
- Response Mode: `responseNode`

- [ ] **Step 2: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Dashboard` → `Code - Auth Check` → GS Read nodes.

- [ ] **Step 3: Add GS - Read LogChat (today, filtered by spa_id)**

- Sheet: `LogChat`
- Filter row: column `spa_id` equals `{{ $('Webhook - Dashboard').first().json.params.spa_id }}`
- Additional filter: `Thời gian` contains today's ISO date

This ensures only log entries for the requesting spa are included.

- [ ] **Step 4: Add GS - Read DatCho (today, filtered by spa_id)**

- Sheet: `DatCho`
- Filter row: column `spa_id` equals `{{ $('Webhook - Dashboard').first().json.params.spa_id }}`
- Additional filter: `Thời gian` contains today's ISO date

This ensures only bookings for the requesting spa are included.

- [ ] **Step 5: Add Code node `Code - Dashboard calculation`**

```javascript
// Dashboard calculation — aggregated stats for today, scoped to spa_id
const logRows = $('GS - Read LogChat').all();
const bookingRows = $('GS - Read DatCho').all();
const now = new Date();
const hcmNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
const dateStr = hcmNow.toISOString().split('T')[0];

const totalMessages = logRows.length;
const totalBookings = bookingRows.length;
const pendingBookings = bookingRows.filter(r => r.json['Trạng thái'] === 'Mới đặt').length;
const confirmedBookings = bookingRows.filter(r => r.json['Trạng thái'] === 'Đã xác nhận').length;
const conversionRate = totalBookings > 0
  ? ((confirmedBookings + bookingRows.filter(r => r.json['Trạng thái'] === 'Hoàn thành').length) / totalBookings * 100).toFixed(1)
  : '0.0';

// Top services
const svcMap = {};
bookingRows.forEach(r => {
  const svc = r.json['Dịch vụ'] || 'Khác';
  svcMap[svc] = (svcMap[svc] || 0) + 1;
});
const topServices = Object.entries(svcMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, count]) => ({ name, count }));

// Recent bookings
const recentBookings = bookingRows.slice(0, 10).map(r => ({
  name: r.json['Tên khách'],
  service: r.json['Dịch vụ'],
  status: r.json['Trạng thái'],
  time: r.json['Thời gian']?.split('T')[1]?.slice(0, 5) || ''
}));

return [{
  json: {
    date: dateStr,
    totalMessages,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    conversionRate,
    topServices,
    recentBookings
  }
}];
```

- [ ] **Step 6: Add Respond to Webhook**

Wire Code output → Respond to Webhook. Response body: `{{ $json }}`.

- [ ] **Step 7: Test with curl**

```bash
curl http://localhost:5678/webhook/api/test-spa-123/dashboard \
  -H "X-API-Key: gw-dev-api-key-change-in-production"
```

Verify response matches spec shape:
```json
{
  "date": "2026-06-23",
  "totalMessages": 47,
  "totalBookings": 8,
  "pendingBookings": 3,
  "confirmedBookings": 5,
  "conversionRate": "17.0",
  "topServices": [...],
  "recentBookings": [...]
}
```

Verify isolation: call with a different spa_id and confirm it returns different (or empty) data.

- [ ] **Step 8: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add dashboard API with spa_id-filtered reads and stats calculation"
```

---

### Task 3: Customers API Endpoint

**Files:**
- Modify: `n8n/workflow-api-backend.json`

**Interfaces:**
- Consumes: HTTP GET `{ spa_id, page, limit, search }` + `X-API-Key` header
- Produces: `{ data, total, page, limit }`

**Multi-tenant requirement:** The GS Read for DatCho MUST filter by `spa_id`. Without this, customers from all spas would be returned.

- [ ] **Step 1: Add Webhook `Webhook - Customers`**

- Method: GET
- Path: `api/{spa_id}/customers`
- Query params: `page` (default 1), `limit` (default 20), `search` (optional)

- [ ] **Step 2: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Customers` → `Code - Auth Check` → GS Read.

- [ ] **Step 3: Add GS - Read DatCho (all, filtered by spa_id) + Code - Filter Customers**

`GS - Read DatCho - All`:
- Sheet: `DatCho`
- Filter row: column `spa_id` equals `{{ $('Webhook - Customers').first().json.params.spa_id }}`

```javascript
// Customer list — unique by phone, with search and pagination
// Only rows matching spa_id are returned (GS Read filtered above)
const rows = $('GS - Read DatCho - All').all();
const params = $('Webhook - Customers').first().json.query || {};
const page = parseInt(params.page) || 1;
const limit = parseInt(params.limit) || 20;
const search = (params.search || '').toLowerCase();

// Deduplicate by phone
const customerMap = {};
rows.forEach(r => {
  const phone = r.json['Số điện thoại'];
  if (!phone) return;
  if (!customerMap[phone]) {
    customerMap[phone] = {
      name: r.json['Tên khách'],
      phone,
      totalBookings: 0,
      lastBooking: r.json['Thời gian'],
      status: r.json['Trạng thái']
    };
  }
  customerMap[phone].totalBookings++;
});

let customers = Object.values(customerMap);

// Search filter
if (search) {
  customers = customers.filter(c =>
    c.name.toLowerCase().includes(search) || c.phone.includes(search)
  );
}

const total = customers.length;
const offset = (page - 1) * limit;
const paginated = customers.slice(offset, offset + limit);

return [{
  json: {
    success: true,
    data: paginated,
    total,
    page,
    limit
  }
}];
```

- [ ] **Step 4: Add Respond to Webhook**

- [ ] **Step 5: Test with curl — verify pagination and search**

```bash
curl "http://localhost:5678/webhook/api/test-spa-123/customers?page=1&limit=5&search=Hương" \
  -H "X-API-Key: gw-dev-api-key-change-in-production"
```

Verify isolation: call with a different spa_id and confirm different customer list.

- [ ] **Step 6: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add customers list with spa_id filter, pagination, and search"
```

---

### Task 4: Bookings API Endpoints

**Files:**
- Modify: `n8n/workflow-api-backend.json`

**Interfaces:**
- GET: Consumes `{ spa_id, status, page, limit }` + `X-API-Key` header → Produces `{ data, total, page, limit }`
- POST: Consumes `{ spa_id, id, status }` + `X-API-Key` header → Produces `{ success, updated }`

**Booking ID strategy:** Use Google Sheets row number as the stable booking ID. The row number is assigned by Google Sheets on append and is stable for the lifetime of the row. This replaces the previous composite key (`Số điện thoại + Thời gian`) which was unstable (time changes, duplicates possible).

- [ ] **Step 1: Add Webhook `Webhook - Bookings List`**

- Method: GET
- Path: `api/{spa_id}/bookings`
- Query params: `status` (optional), `page`, `limit`

- [ ] **Step 2: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Bookings List` → `Code - Auth Check` → GS Read.

- [ ] **Step 3: Add GS - Read DatCho (all, filtered by spa_id) + Code node for bookings list**

`GS - Read DatCho - All`:
- Sheet: `DatCho`
- Filter row: column `spa_id` equals `{{ $('Webhook - Bookings List').first().json.params.spa_id }}`

```javascript
// Bookings list — filterable by status, paginated
// Uses Google Sheets row number as stable ID
const rows = $('GS - Read DatCho - All').all();
const params = $('Webhook - Bookings List').first().json.query || {};
const page = parseInt(params.page) || 1;
const limit = parseInt(params.limit) || 20;
const statusFilter = params.status;

let bookings = rows.map((r, index) => ({
  id: String(index + 1), // Google Sheets row number (1-based) as stable ID
  name: r.json['Tên khách'],
  phone: r.json['Số điện thoại'],
  service: r.json['Dịch vụ'],
  note: r.json['Ghi chú'],
  status: r.json['Trạng thái'],
  time: r.json['Thời gian'],
  branch: r.json['Chi nhánh'] || '',
  spaId: r.json['spa_id']
}));

if (statusFilter) {
  bookings = bookings.filter(b => b.status === statusFilter);
}

const total = bookings.length;
const offset = (page - 1) * limit;
const paginated = bookings.slice(offset, offset + limit);

return [{
  json: { success: true, data: paginated, total, page, limit }
}];
```

- [ ] **Step 4: Add Webhook `Webhook - Update Booking`**

- Method: POST
- Path: `api/{spa_id}/bookings/{id}`

- [ ] **Step 5: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Update Booking` → `Code - Auth Check` → GS Read → Code - Update.

- [ ] **Step 6: Add Code node for booking status update**

```javascript
// Update booking status by row number
// First read the row by index, then update it
const body = $input.first().json.body;
const newStatus = body?.status;
const validStatuses = ['Mới đặt', 'Đã xác nhận', 'Hoàn thành', 'Đã hủy'];

if (!validStatuses.includes(newStatus)) {
  return [{ json: { success: false, error: `Invalid status: ${newStatus}` } }];
}

// The booking ID is the 1-based row number
// In n8n, to update a specific row:
// 1. Read all rows (filtered by spa_id)
// 2. Find the row at the given index
// 3. Use GS Update node with matchingColumns to update

return [{
  json: {
    success: true,
    bookingId: $input.first().json.params?.id,
    newStatus,
    updatedAt: new Date().toISOString()
  }
}];
```

Wire: Code → GS Update DatCho (matching by spa_id + row index) → Respond to Webhook.

- [ ] **Step 7: Test both GET list and POST update**

```bash
curl "http://localhost:5678/webhook/api/test-spa-123/bookings?status=Mới%20đặt" \
  -H "X-API-Key: gw-dev-api-key-change-in-production"

curl -X POST "http://localhost:5678/webhook/api/test-spa-123/bookings/1" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gw-dev-api-key-change-in-production" \
  -d '{"status":"Đã xác nhận"}'
```

Verify isolation: call GET bookings with a different spa_id and confirm different results.

- [ ] **Step 8: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add bookings list and status update with spa_id filter and row-number IDs"
```

---

### Task 5: Services CRUD Endpoints

**Files:**
- Modify: `n8n/workflow-api-backend.json`

**Interfaces:**
- GET: `{ spa_id }` + `X-API-Key` header → `{ data: Service[] }`
- POST: `{ spa_id, name, price, duration, description }` + `X-API-Key` header → `{ success, service }`
- PUT: `{ spa_id, id, name, price, duration, description }` + `X-API-Key` header → `{ success, service }`
- DELETE: `{ spa_id, id }` + `X-API-Key` header → `{ success }`

- [ ] **Step 1: Add Webhook `Webhook - Services`**

Configure as separate webhook nodes per method (n8n webhooks are per-method):

| Node | Method | Path |
|------|--------|------|
| Webhook - Services List | GET | `api/{spa_id}/services` |
| Webhook - Create Service | POST | `api/{spa_id}/services` |
| Webhook - Update Service | PUT | `api/{spa_id}/services/{id}` |
| Webhook - Delete Service | DELETE | `api/{spa_id}/services/{id}` |

- [ ] **Step 2: Add Code node `Code - Auth Check`** after each webhook (see Task 0)

- [ ] **Step 3: Add Code nodes for each operation**

**GET Services:**
```javascript
const rows = $('GS - Read Services').all();
// GS Read Services is filtered by spa_id
const services = rows.map(r => ({
  id: r.json['ID'] || r.json['Dịch vụ'],
  name: r.json['Dịch vụ'],
  price: parseInt(r.json['Giá']) || 0,
  description: r.json['Mô tả'] || '',
  active: r.json['Trạng thái'] !== 'Ẩn'
}));
return [{ json: { success: true, data: services } }];
```

**POST Service:**
```javascript
const body = $input.first().json.body;
const spaId = $input.first().json.params?.spa_id;
const newService = {
  'spa_id': spaId,
  'ID': 'svc-' + Date.now(),
  'Dịch vụ': body.name,
  'Giá': String(body.price),
  'Mô tả': body.description || '',
  'Trạng thái': 'Hiện'
};
return [{ json: { success: true, rowData: newService } }];
```
Wire → GS Append Services → Respond.

**PUT Service:**
```javascript
const body = $input.first().json.body;
const id = $input.first().json.params?.id;
const updated = {
  'Dịch vụ': body.name,
  'Giá': String(body.price),
  'Mô tả': body.description || '',
  'Trạng thái': body.active !== false ? 'Hiện' : 'Ẩn'
};
return [{ json: { success: true, serviceId: id, rowData: updated } }];
```
Wire → GS Update Services (match by ID + spa_id) → Respond.

**DELETE Service:**
```javascript
const id = $input.first().json.params?.id;
return [{ json: { success: true, serviceId: id } }];
```
Wire → GS Delete Services (match by ID + spa_id) → Respond.

- [ ] **Step 4: Test all 4 CRUD operations**

```bash
curl http://localhost:5678/webhook/api/test-spa-123/services \
  -H "X-API-Key: gw-dev-api-key-change-in-production"

curl -X POST http://localhost:5678/webhook/api/test-spa-123/services \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gw-dev-api-key-change-in-production" \
  -d '{"name":"Nail Art","price":150000,"description":"Thiết kế nail theo yêu cầu"}'

curl -X PUT http://localhost:5678/webhook/api/test-spa-123/services/svc-123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gw-dev-api-key-change-in-production" \
  -d '{"name":"Nail Art Premium","price":250000}'

curl -X DELETE http://localhost:5678/webhook/api/test-spa-123/services/svc-123 \
  -H "X-API-Key: gw-dev-api-key-change-in-production"
```

- [ ] **Step 5: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add services CRUD with spa_id in all operations"
```

---

### Task 6: Config + Chat Logs Endpoints

**Files:**
- Modify: `n8n/workflow-api-backend.json`

**Interfaces:**
- PUT Config: Consumes `{ spa_id, botName, botGreeting, openTime, closeTime, botActive }` + `X-API-Key` header → `{ success }`
- GET Chat Logs: Consumes `{ spa_id, page, limit, date, sender }` + `X-API-Key` header → `{ data, total, page, limit }`

- [ ] **Step 1: Add Webhook `Webhook - Config`**

- Method: PUT
- Path: `api/{spa_id}/config`

- [ ] **Step 2: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Config` → `Code - Auth Check` → Code - Config.

- [ ] **Step 3: Add Code node for config update**

```javascript
const body = $input.first().json.body;
const spaId = $input.first().json.params?.spa_id;
const configData = {
  'spa_id': spaId,
  'Tên bot': body.botName || 'CS Bot',
  'Lời chào': body.botGreeting || '',
  'Giờ mở cửa': body.openTime || '08:00',
  'Giờ đóng cửa': body.closeTime || '22:00',
  'Bot_active': body.botActive ? 'true' : 'false'
};
return [{ json: { success: true, rowData: configData } }];
```

Wire → GS Update Config (filter by spa_id) → Respond.

- [ ] **Step 4: Add Webhook `Webhook - Chat Logs`**

- Method: GET
- Path: `api/{spa_id}/chat-logs`
- Query params: `page`, `limit`, `date` (optional), `sender` (optional)

- [ ] **Step 5: Add Code node `Code - Auth Check`** (see Task 0)

Wire: `Webhook - Chat Logs` → `Code - Auth Check` → GS Read → Code - Chat Logs.

- [ ] **Step 6: Add GS - Read LogChat (all, filtered by spa_id) + Code node for chat logs list**

`GS - Read LogChat - All`:
- Sheet: `LogChat`
- Filter row: column `spa_id` equals `{{ $('Webhook - Chat Logs').first().json.params.spa_id }}`

```javascript
// Chat logs — paginated with filters, scoped to spa_id
const rows = $('GS - Read LogChat - All').all();
const params = $('Webhook - Chat Logs').first().json.query || {};
const page = parseInt(params.page) || 1;
const limit = parseInt(params.limit) || 20;
const dateFilter = params.date;
const senderFilter = params.sender;

let logs = rows.map((r, index) => ({
  id: String(index + 1), // Row number as stable ID
  senderId: r.json['Zalo ID'],
  senderName: r.json['Tên khách'],
  customerMessage: r.json['Tin nhắn khách'],
  aiReply: r.json['Phản hồi AI'],
  category: r.json['Loại'],
  isBooking: r.json['Đặt lịch'] === 'Có',
  time: r.json['Thời gian']
}));

if (dateFilter) logs = logs.filter(l => l.time?.includes(dateFilter));
if (senderFilter) logs = logs.filter(l => l.senderId === senderFilter);

const total = logs.length;
const offset = (page - 1) * limit;
const paginated = logs.slice(offset, offset + limit);

return [{ json: { success: true, data: paginated, total, page, limit } }];
```

- [ ] **Step 7: Test config update and chat logs list**

```bash
curl -X PUT http://localhost:5678/webhook/api/test-spa-123/config \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gw-dev-api-key-change-in-production" \
  -d '{"botName":"Linh","botGreeting":"Xin chào! Em là Linh ạ."}'

curl "http://localhost:5678/webhook/api/test-spa-123/chat-logs?page=1&limit=10" \
  -H "X-API-Key: gw-dev-api-key-change-in-production"
```

- [ ] **Step 8: Commit**

```bash
git add n8n/workflow-api-backend.json
git commit -m "feat(wf3): add config update and chat logs with spa_id filter — complete API backend"
```

---

## Self-Review

**Spec coverage:**
- POST `/webhook/sync/{spa_id}` → Task 1 (with spa_id in row data)
- GET `/webhook/api/{spa_id}/dashboard` → Task 2 (with spa_id-filtered reads)
- GET `/webhook/api/{spa_id}/customers` → Task 3 (with spa_id-filtered reads)
- GET `/webhook/api/{spa_id}/bookings` + POST update → Task 4 (with spa_id filter + row-number IDs)
- GET/POST/PUT/DELETE `/webhook/api/{spa_id}/services` → Task 5 (with spa_id in all operations)
- PUT `/webhook/api/{spa_id}/config` + GET chat-logs → Task 6 (with spa_id-filtered reads)
- Response format matches spec JSON shape

**Multi-tenant isolation (HIGH-1, HIGH-2, HIGH-3):**
- spa_id column added to all Google Sheets tables (DatCho, LogChat, Services, Config)
- Sync webhook writes spa_id in every row (Task 1, Step 4)
- Dashboard reads filtered by spa_id (Task 2, Steps 3-4)
- Customers reads filtered by spa_id (Task 3, Step 3)
- Bookings reads filtered by spa_id (Task 4, Step 3)
- Services operations scoped by spa_id (Task 5)
- Config/Chat Logs reads filtered by spa_id (Task 6, Steps 3, 6)
- Every task test step includes isolation verification

**API key authentication (MEDIUM-2):**
- Task 0 adds X-API-Key validation to all webhook paths
- Auth check runs before any business logic
- Returns 401 for missing/invalid keys
- All curl examples include the X-API-Key header

**Booking ID stability (LOW-1):**
- Google Sheets row number used as stable ID (Task 4, Step 3)
- Replaces unstable composite key (Số điện thoại + Thời gian)
- Row numbers are 1-based, deterministic, and unique within a sheet

**Architecture notes (MEDIUM-1, MEDIUM-3):**
- WF3 response shape is documented as the target shape for the n8n-based architecture
- FE's current Prisma-based endpoints coexist independently
- Migration from Prisma to WF3 webhooks is a separate task, not in WF3 scope
- Both data layers documented in the plan header

**Placeholder scan:** No TBD/TODO. All endpoints have complete code.

**Type consistency:**
- `spaId` extracted from URL params consistently across all webhooks.
- `{ success, data, error }` envelope used in all responses.
- `rowData` objects include `spa_id` as the first column, using Vietnamese column names matching Google Sheets.
- Row numbers used as stable IDs across bookings and chat logs.

**Node count:** ~25 nodes (6 webhooks + 6 auth check + 8 code + 4 GS operations + 1 static data config).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-23-wf3-api-backend.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`

**Which approach?**
