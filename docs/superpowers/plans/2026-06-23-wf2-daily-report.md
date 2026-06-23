# WF2 Daily Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new n8n workflow that automatically generates and sends a daily business report to the spa owner at 8:00 AM every day via Zalo.

**Architecture:** A linear workflow: Schedule Trigger -> Date Setup -> Read LogChat -> Read DatCho -> Calculate Stats -> Format Report -> Send Zalo. All data comes from Google Sheets (same sheets used by WF1 CS Bot).

**Tech Stack:** n8n, JavaScript (Code nodes v2), Google Sheets (OAuth2), Zalo API (Gemazo), Gemini Flash Lite (optional, for natural language summary).

**Node count note:** The spec's "Nodes (5)" list omits the Format step that appears in its own flow diagram (6 steps). This plan adds a `Code - Date Setup` node (practical: GS Read nodes need a concrete date value for column filtering). Total: 5 core nodes + Date Setup + Schedule Trigger = 7 nodes. The spec has an internal inconsistency between its node count (5) and its flow diagram (6 steps including Format).

## Global Constraints

- All Code nodes use `n8n-nodes-base.code` typeVersion 2.
- Google Sheets credentials match WF1 (`googleSheetsOAuth2Api`).
- Zalo credentials match WF1 (`zaloApi`).
- Cron schedule: `0 8 * * *` (8:00 AM HCM daily).
- Report language: Vietnamese only.
- New workflow -- separate from WF1. Do NOT modify `workflow-improved.json`.

## Target Flow

```
[Schedule Trigger: 0 8 * * *]
  -> [Code - Date Setup]
  -> [GS Read LogChat (hom qua)]
  -> [GS Read DatCho (hom qua)]
  -> [Code: Tinh toan thong ke]
  -> [Code: Format bao cao]
  -> [Zalo: Gui bao cao cho chu spa]
```

## Report Format (Spec Reference)

```
Bao Cao Ngay 23/06/2026
========================

Tin nhan: 47
Dat lich moi: 8
Da xac nhan: 5
Chua xac nhan: 3
Ty le chuyen doi: 17.0%

Dich vu quan tam nhat:
  1. Lam toc (23 booking)
  2. Cham soc da (12 booking)

Phan nan: 2 tin
Can xac nhan: 3 booking

Chuc spa mot ngay hieu qua!
```

**Conversion rate formula (from spec):** `newBookings / totalMessages * 100`. Example: 8 bookings / 47 messages = 17.0%.

---

### Task 1: Create Workflow + Schedule Trigger

**Files:**
- Create: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: None (cron trigger)
- Produces: `{ runDate, runDateStr }` (today's date for downstream filtering)

- [ ] **Step 1: Create new workflow in n8n UI**

Click "New Workflow" -> name it `Daily Report - Ghost Worker`.

- [ ] **Step 2: Add Schedule Trigger node**

Add `Schedule Trigger` node (typeVersion 1.2):
- Rule: Cron
- Cron expression: `0 8 * * *`
- Timezone: `Asia/Ho_Chi_Minh`

This fires at 8:00 AM HCM every day.

- [ ] **Step 3: Add Code node `Code - Date Setup`**

```javascript
// Date Setup - calculate yesterday's date for data queries
// ponytail: This timezone handling via toLocaleString is fragile across
// Node.js versions and edge cases (DST transitions). For production,
// consider replacing with date-fns + date-fns-tz for reliable timezone
// conversion: format(zonedTimeToUtc(subDays(new Date(), 1), 'Asia/Ho_Chi_Minh'), 'yyyy-MM-dd')
const now = new Date();
const hcmNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
const yesterday = new Date(hcmNow);
yesterday.setDate(yesterday.getDate() - 1);

const dd = String(yesterday.getDate()).padStart(2, '0');
const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
const yyyy = yesterday.getFullYear();
const dateStr = `${dd}/${mm}/${yyyy}`;
const isoDate = `${yyyy}-${mm}-${dd}`;

return [{
  json: {
    runDate: yesterday.toISOString(),
    runDateStr: dateStr,
    isoDate,
    dayOfWeek: yesterday.toLocaleDateString('vi-VN', { weekday: 'long' })
  }
}];
```

- [ ] **Step 4: Commit skeleton**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): scaffold Daily Report workflow with schedule trigger"
```

---

### Task 2: Read LogChat (Yesterday)

**Files:**
- Modify: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: `Code - Date Setup` output (`isoDate`)
- Produces: Array of log chat rows from yesterday

- [ ] **Step 1: Add Google Sheets node `GS - Read LogChat`**

Configure:
- Operation: Read
- Document: Same LogChat sheet used by WF1
- Sheet: `LogChat`
- Filters: Column `Thoi gian` contains `{{ $json.isoDate }}` (or `{{ $json.runDateStr }}`)

- [ ] **Step 2: Test with yesterday's data**

Verify the node returns rows with columns: `Thoi gian`, `Zalo ID`, `Ten khach`, `Tin nhan khach`, `Phan hoi AI`, `Loai`, `Dat lich`.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): add LogChat reader for daily report"
```

---

### Task 3: Read DatCho (Yesterday)

**Files:**
- Modify: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: `Code - Date Setup` output (`isoDate`)
- Produces: Array of booking rows from yesterday

- [ ] **Step 1: Add Google Sheets node `GS - Read DatCho`**

Configure:
- Operation: Read
- Document: Same DatCho sheet used by WF1
- Sheet: `DatCho`
- Filters: Column `Thoi gian` contains `{{ $json.isoDate }}`

- [ ] **Step 2: Test with yesterday's data**

Verify columns: `Thoi gian`, `Ten khach`, `So dien thoai`, `Dich vu`, `Ghi chu`, `Zalo ID`, `Trang thai`.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): add DatCho reader for daily report"
```

---

### Task 4: Calculate Statistics

**Files:**
- Modify: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: LogChat rows + DatCho rows (from sequential reads)
- Produces: `{ totalMessages, newBookings, confirmed, pending, completed, cancelled, conversionRate, topServices, complaints, isEmpty }`

- [ ] **Step 1: Add Code node `Code - Tinh toan thong ke`**

This node receives data from both GS Read nodes. In n8n, when nodes connect in sequence, `$input.all()` contains the combined results. Since our reads are sequential, we reference prior node outputs via `$()`.

```javascript
// Statistics Calculator - aggregate daily metrics
const logRows = $('GS - Read LogChat').all();
const bookingRows = $('GS - Read DatCho').all();

// --- Empty-state guard ---
// If both sources returned no rows, emit a minimal "no data" report
// so the workflow still sends something instead of failing silently.
if (logRows.length === 0 && bookingRows.length === 0) {
  return [{
    json: {
      totalMessages: 0,
      newBookings: 0,
      confirmed: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
      conversionRate: '0.0',
      topServices: [],
      complaints: 0,
      isEmpty: true
    }
  }];
}

// --- Message stats ---
const totalMessages = logRows.length;

// --- Booking stats ---
const newBookings = bookingRows.length;
const confirmed = bookingRows.filter(r => r.json['Trang thai'] === 'Da xac nhan').length;
const pending = bookingRows.filter(r => r.json['Trang thai'] === 'Moi dat').length;
const completed = bookingRows.filter(r => r.json['Trang thai'] === 'Hoan thanh').length;
const cancelled = bookingRows.filter(r => r.json['Trang thai'] === 'Da huy').length;

// --- Conversion rate ---
// Formula per spec: newBookings / totalMessages * 100
// Example: 8 bookings / 47 messages = 17.0%
const conversionRate = totalMessages > 0
  ? (newBookings / totalMessages * 100).toFixed(1)
  : '0.0';

// --- Top services ---
const serviceCount = {};
bookingRows.forEach(r => {
  const svc = r.json['Dich vu'] || 'Khong ro';
  serviceCount[svc] = (serviceCount[svc] || 0) + 1;
});
const topServices = Object.entries(serviceCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, count]) => ({ name, count }));

// --- Complaints ---
const complaints = logRows.filter(r => {
  const type = (r.json['Loai'] || '').toLowerCase();
  return type.includes('phan nan') || type.includes('complaint');
}).length;

return [{
  json: {
    totalMessages,
    newBookings,
    confirmed,
    pending,
    completed,
    cancelled,
    conversionRate,
    topServices,
    complaints,
    isEmpty: false
  }
}];
```

- [ ] **Step 2: Test with sample data**

Create test rows in LogChat and DatCho sheets for yesterday, verify stats match expected values. Test the empty-state branch with no rows.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): add statistics calculator node"
```

---

### Task 5: Format Report

**Files:**
- Modify: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: Statistics output from Task 4
- Produces: `{ reportText }` -- formatted Vietnamese report string

- [ ] **Step 1: Add Code node `Code - Format bao cao`**

```javascript
// Report Formatter - Vietnamese daily report with emoji
const s = $input.first().json;
const dateStr = $('Code - Date Setup').first().json.runDateStr;

// Empty state: emit minimal report
if (s.isEmpty) {
  return [{
    json: {
      reportText: `Bao Cao Ngay ${dateStr}\n========================\n\nKhong co du lieu hom qua.\n\nChuc spa mot ngay hieu qua!`
    }
  }];
}

// Top services list
let topSvcText = '';
if (s.topServices.length > 0) {
  topSvcText = s.topServices
    .map((svc, i) => `  ${i + 1}. ${svc.name} (${svc.count} booking)`)
    .join('\n');
} else {
  topSvcText = '  (Khong co du lieu)';
}

// Complaints line - always shown per spec, even when 0
const complaintLine = `\nPhan nan: ${s.complaints} tin`;

// Pending confirm line - always shown per spec, even when 0
const pendingLine = `\nCan xac nhan: ${s.pending} booking`;

const report = `Bao Cao Ngay ${dateStr}
========================

Tin nhan: ${s.totalMessages}
Dat lich moi: ${s.newBookings}
Da xac nhan: ${s.confirmed}
Chua xac nhan: ${s.pending}
Ty le chuyen doi: ${s.conversionRate}%

Dich vu quan tam nhat:
${topSvcText}
${complaintLine}${pendingLine}

Chuc spa mot ngay hieu qua!`;

return [{
  json: {
    reportText: report
  }
}];
```

- [ ] **Step 2: Test output formatting**

Verify the report string matches the spec format exactly. Check edge cases: 0 messages, 0 bookings, 5+ services, all-zero complaint/pending lines.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): add report formatter node"
```

---

### Task 6: Send Report via Zalo

**Files:**
- Modify: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: `{ reportText }` from Task 5
- Produces: Zalo message sent to owner

- [ ] **Step 1: Add Zalo node `Zalo - Gui bao cao`**

Configure:
- Type: `n8n-nodes-zalo-gemazo.zaloMessage` (typeVersion 4)
- Credentials: Same `zaloApi` as WF1
- Recipient: Owner's Zalo ID (configurable via env var or hardcoded per spa)
- Message: `{{ $json.reportText }}`

- [ ] **Step 2: Test full flow end-to-end**

Trigger workflow manually in n8n -> verify report arrives in owner's Zalo.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): add Zalo report sender -- complete daily report workflow"
```

---

### Task 7: Multi-Branch Support (Phase 4 Prep)

**Note:** Multi-branch support is NOT required by the Phase 2 spec. The Phase 2 spec describes a single-branch daily report. Multi-branch is introduced in Phase 4 (Owner Web Dashboard). This task is kept here as forward-looking prep work. It can be deferred to Phase 4 without blocking the Phase 2 daily report from going live.

**Files:**
- Modify: `n8n/workflow-daily-report.json`

**Interfaces:**
- Consumes: Branch list from Google Sheets
- Produces: Per-branch reports (or aggregate with branch breakdown)

- [ ] **Step 1: Add branch-aware filtering**

Update `GS - Read LogChat` and `GS - Read DatCho` to include branch column filtering. Add a branch breakdown section to the report:

```javascript
// In Code - Tinh toan thong ke, add:
const branchStats = {};
bookingRows.forEach(r => {
  const branch = r.json['Chi nhanh'] || 'Tat ca';
  if (!branchStats[branch]) branchStats[branch] = { bookings: 0, services: {} };
  branchStats[branch].bookings++;
  const svc = r.json['Dich vu'] || 'Khong ro';
  branchStats[branch].services[svc] = (branchStats[branch].services[svc] || 0) + 1;
});
```

- [ ] **Step 2: Update report format with branch section**

Only show branch breakdown if spa has >1 branch. If single branch, skip section.

```javascript
// In Code - Format bao cao, add:
const branchEntries = Object.entries(branchStats);
let branchSection = '';
if (branchEntries.length > 1) {
  branchSection = '\nTheo chi nhanh:\n' + branchEntries
    .map(([name, stats]) => `  - ${name}: ${stats.bookings} booking`)
    .join('\n');
}
// Insert into report after top services section
```

- [ ] **Step 3: Test with multi-branch data**

- [ ] **Step 4: Commit**

```bash
git add n8n/workflow-daily-report.json
git commit -m "feat(wf2): add multi-branch breakdown to daily report (Phase 4 prep)"
```

---

## Self-Review

**Spec coverage:**
- Schedule Trigger (cron 0 8 * * *) -> Task 1
- Read LogChat -> Task 2
- Read DatCho -> Task 3
- Calculate stats -> Task 4
- Format report -> Task 5
- Send via Zalo -> Task 6
- Multi-branch support -> Task 7 (Phase 4 prep, not required by Phase 2 spec)

**Report format matches spec:**
- Title uses `Bao Cao Ngay {date}` only -- no day-of-week appended to title (matches spec).
- Complaint and pending lines always shown, even when count is 0, per spec.
- Conversion rate formula: `newBookings / totalMessages * 100` matches spec example (8/47 = 17.0%).
- Empty-state guard: if both LogChat and DatCho return 0 rows, emits a minimal "no data" report instead of failing silently.

**Node count:**
- Spec lists 5 nodes and shows 6 steps in flow diagram (the Format step is in the diagram but missing from the node list -- internal inconsistency within the spec).
- Plan has 7 nodes: Schedule Trigger + Date Setup + GS Read LogChat + GS Read DatCho + Stats + Format + Zalo Send.
- Date Setup is a practical implementation detail: GS Read nodes need a concrete date value for column filtering, so computing yesterday's date once in a dedicated node avoids duplication in each GS Read.

**Placeholder scan:** No TBD/TODO. All node configs are complete.

**Type consistency:**
- `runDateStr` from Task 1 consumed in Task 5. Shape: `"23/06/2026"`.
- `isoDate` from Task 1 consumed in Tasks 2 and 3. Shape: `"2026-06-22"`.
- `stats` object from Task 4 consumed in Task 5. All fields explicitly named. `pending` used directly in Task 5 (no redundant alias).
- `reportText` from Task 5 consumed in Task 6. Shape: string.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-23-wf2-daily-report.md`. Two execution options:**

**1. Subagent-Driven (recommended)** -- I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** -- Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review

**Which approach?**
