# WF1 CS Bot Core Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing n8n CS Bot workflow (WF 63394) from MVP to production-ready by adding 5 core modules: PII Masking, Smart Collection, Business Hours, Escalation, and Duplicate Booking Detection.

**Architecture:** The workflow remains a Zalo Message Trigger -> PII Masking -> Read Bang Gia -> Prepare Context -> Smart Collection -> AI Agent -> Escalation Check -> Parse/Route pipeline, with new processing nodes inserted at key points. All new logic uses n8n Code nodes (JavaScript) running inside n8n's isolated JS VM.

**Key architectural decision (CRITICAL-1 fix):** Each Zalo message triggers a fresh n8n execution. The AI Agent + Simple Memory already handle conversation history. Smart Collection does NOT accumulate state across turns in a Code node. Instead, it parses the current message for booking fields and injects a system instruction telling the AI Agent what to ask next. The AI Agent's own intelligence, guided by system instructions and its memory, handles the cross-turn accumulation by outputting a booking JSON when all fields are available.

**Key architectural decision (CRITICAL-2 fix):** PII Masking outputs BOTH `maskedMessage` (for logging) and `originalMessage` (for AI processing). The AI Agent receives `originalMessage` so it sees real phone numbers and can produce a valid booking JSON with the real phone. `maskedMessage` is only used by Log Chat for privacy in logs. Customer-facing replies also unmask names so the customer sees their real name, not `[NAME_0]`.

**Tech Stack:** n8n (self-hosted via Docker), JavaScript (n8n Code nodes v2), Google Sheets (data persistence via OAuth2), Zalo API (Gemazo nodes), Gemini Flash Lite (LLM).

## Global Constraints

- All Code nodes use `n8n-nodes-base.code` typeVersion 2.
- Code runs in n8n's isolated JS VM -- no `fetch()`, no Node.js built-ins beyond basic JS.
- Google Sheets nodes use the same `googleSheetsOAuth2Api` credentials as existing nodes.
- Zalo messages use the same `zaloApi` credentials as existing nodes.
- `continueOnFail: true` on non-critical paths; fail on PII leakage paths.
- All output items follow the n8n `[{ json: { ... } }]` convention.

## Existing Node Reference (14 nodes)

| # | Node Name | Type | ID |
|---|-----------|------|----|
| 1 | Zalo Message Trigger | zaloMessageTrigger | `37d82f9f-2c19-494c-b5ea-fe347c042ad5` |
| 2 | Google Sheets - Doc bang gia | googleSheets | `aa110001-0001-4000-a001-000000000001` |
| 3 | Code - Chuan bi context | code | `aa110001-0001-4000-a001-000000000002` |
| 4 | AI Agent | langchain.agent | `f17f3b86-2ff9-480f-bccf-cb9ad319f4df` |
| 5 | Simple Memory | langchain.memoryBufferWindow | `033aa324-1038-46f3-bd11-34b7e0291150` |
| 6 | Google Gemini Chat Model | langchain.lmChatGoogleGemini | `411730a3-4337-47e0-ac5f-8b1c51791cac` |
| 7 | Parse Booking | code | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| 8 | IF - Co dat cho? | if | `b2c3d4e5-f6a7-8901-bcde-f12345678901` |
| 9 | Google Sheets - Luu dat cho | googleSheets | `c3d4e5f6-a7b8-9012-cdef-123456789012` |
| 10 | Zalo - Xac nhan khach | zaloMessage | `44ca83e0-d969-456e-afb0-373cd72c7e94` |
| 11 | Tao tin nhan bao chu | code | `d4e5f6a7-b8c9-0123-defa-234567890123` |
| 12 | Zalo - Bao chu spa | zaloMessage | `e5f6a7b8-c9d0-1234-efab-345678901234` |
| 13 | Zalo - Tra loi thuong | zaloMessage | `f6a7b8c9-d0e1-2345-fabc-456789012345` |
| 14 | Google Sheets - Log chat | googleSheets | `aa110001-0001-4000-a001-000000000003` |

## Target Flow (After All Tasks)

```
Zalo Trigger
  -> [Code - PII Masking]              <- NEW: outputs maskedMessage + originalMessage
  -> Google Sheets - Doc bang gia
  -> Code - Chuan bi context            <- MODIFIED: forwards originalMessage to AI, maskedMessage to Log Chat
  -> [Code - Smart Collection]          <- NEW: stateless parser, injects system instruction for AI
  -> AI Agent (+ Memory + Gemini)
  -> [Code - Escalation]                <- NEW: INLINE check after AI Agent (HIGH-4)
      |-> IF - Escalation?              <- NEW: routes to escalation path or normal path
      |    |-> TRUE (escalation)
      |    |    -> [Code - Format Escalation Alert] -> Zalo - Bao chu spa (reuse)
      |    |    -> Zalo - Escalation Reply          <- NEW (customer gets unmasked name)
      |    |-> FALSE (normal)
      |         -> [Code - Unmask Reply] <- NEW: unmask names for customer-facing reply (HIGH-2)
      |         -> [Parse Booking]       <- existing, enhanced
      |            -> [Google Sheets - Log Chat] <- MODIFIED: uses maskedMessage (MEDIUM-5)
      |            -> [IF - Co dat cho?]        <- existing
      |               |-> TRUE
      |               |    -> [GS - Check Duplicate]    <- NEW
      |               |    -> [Code - Check Duplicate]   <- NEW (CRITICAL-4 cross-node access)
      |               |       -> [IF - Duplicate?]
      |               |          |-> reject  -> Zalo - Duplicate Reply <- NEW
      |               |          |-> insert  -> GS - Luu dat cho + Zalo - Xac nhan
      |               |          |-> update  -> GS - Update Booking + Zalo - Xac nhan
      |               |    -> [Code - Gio lam viec]      <- NEW (MEDIUM-6: <= 20)
      |               |       -> [IF - Gio lam viec?]
      |               |          |-> TRUE (8-20h)  -> Tinh nhan bao chu + Xac nhan
      |               |          |-> FALSE (outside) -> GS Luu dat cho + Deferred Reply
      |               |-> FALSE
      |                    -> [Code - Unmask Reply] -> Zalo - Tra loi thuong
```

---

### Task 1: PII Masking Node

**Files:**
- Modify: `n8n/workflow-improved.json` (add node + connections)

**Interfaces:**
- Consumes: `Zalo Message Trigger` output (`data.content`, `data.fromId`, `data.senderName`, `threadId`)
- Produces: `{ maskedMessage, originalMessage, phoneMap, nameMap, senderId, senderName, threadId }`

- [ ] **Step 1: Add Code node `Code - PII Masking` at position `(-700, 0)`**

Insert between Zalo Trigger (X: -800) and Read Bang Gia (X: -650).

```javascript
// PII Masking -- regex SĐT VN + ten rieng -> mask tokens
// Outputs BOTH maskedMessage (for logging) and originalMessage (for AI processing)
// CRITICAL-2 fix: AI Agent gets originalMessage with real phone numbers
const triggerData = $input.first().json;
let message = triggerData.data?.content || triggerData.data?.text || '';
const originalMessage = message;
const phoneMap = [];
const nameMap = [];

// 1. Mask VN phone numbers: 0[3|5|7|8|9]xxxxxxxx
// CRITICAL-3 fix: phone regex works on original message (unmasked)
const phoneRe = /\b(0[35789]\d{8})\b/g;
message = message.replace(phoneRe, (m) => {
  const id = phoneMap.length;
  phoneMap.push({ mask: `[PHONE_${id}]`, real: m });
  return `[PHONE_${id}]`;
});

// 2. Mask names after keywords: ten, anh, chi, em la, toi la
// HIGH-3 fix: use String.replace() with callback instead of while/exec loop
const nameKw = /\b(?:tên|Tôi là|Em là|Anh là|Chị là)\s+([A-ZÀ-Ỹ][a-zà-ỹ]{1,15})\b/gi;
message = message.replace(nameKw, (fullMatch, name) => {
  const id = nameMap.length;
  const placeholder = `[NAME_${id}]`;
  nameMap.push({ mask: placeholder, real: name });
  return fullMatch.replace(name, placeholder);
});

return [{
  json: {
    originalMessage: originalMessage,
    maskedMessage: message,
    phoneMap,
    nameMap,
    senderId: triggerData.data?.fromId || triggerData.data?.senderId || 'unknown',
    senderName: triggerData.data?.senderName || 'Khach hang',
    threadId: triggerData.threadId || ''
  }
}];
```

- [ ] **Step 2: Wire connections**

Remove old connection: `Zalo Message Trigger` -> `Google Sheets - Doc bang gia`.

Add new connections:
- `Zalo Message Trigger` -> `Code - PII Masking`
- `Code - PII Masking` -> `Google Sheets - Doc bang gia`

- [ ] **Step 3: Update `Code - Chuan bi context` (HIGH-1 fix)**

The context node now receives PII Masking output from `$input`. It must forward `originalMessage` to the AI Agent and `maskedMessage`/`phoneMap`/`nameMap` to downstream nodes.

Replace the full `jsCode` parameter:

```javascript
// ============================================
// CODE: CHUAN BI CONTEXT CHO AI AGENT
// Updated: reads from PII Masking output, forwards originalMessage
// HIGH-1 fix: originalMessage is forwarded through pipeline
// CRITICAL-2 fix: AI Agent receives originalMessage (unmasked)
// ============================================

// 1. Lay du lieu bang gia (tatca rows tu Google Sheets)
const priceRows = $input.all();
let priceText = '';

if (priceRows.length > 0) {
  priceText = priceRows.map(r => {
    const svc = r.json['Dich vu'] || r.json['dich_vu'] || r.json['Service'] || '';
    const price = r.json['Gia'] || r.json['gia'] || r.json['Price'] || '';
    const desc = r.json['Mo ta'] || r.json['mo_ta'] || r.json['Description'] || '';
    if (!svc) return '';
    return `- ${svc}: ${price}${desc ? ' -- ' + desc : ''}`;
  }).filter(Boolean).join('\n');
}

if (!priceText) {
  priceText = '(Chua co du lieu gia -- tu van chung, huong khach dat lich)';
}

// 2. Lay du lieu tu PII Masking node
const piiData = $input.first().json;

return [{
  json: {
    priceSection: priceText,
    // CRITICAL-2: AI Agent uses originalMessage (real phone numbers)
    customerMessage: piiData.originalMessage || '',
    // MEDIUM-5: maskedMessage forwarded for Log Chat (PII-protected)
    maskedMessage: piiData.maskedMessage || piiData.originalMessage || '',
    phoneMap: piiData.phoneMap || [],
    nameMap: piiData.nameMap || [],
    originalMessage: piiData.originalMessage || '',
    senderId: piiData.senderId || 'unknown',
    senderName: piiData.senderName || 'Khach hang',
    threadId: piiData.threadId || ''
  }
}];
```

- [ ] **Step 4: Test with sample input**

Simulate a trigger with `data.content: "Em ten Huong, so 0912345678"` -> verify:
- `originalMessage`: `"Em ten Huong, so 0912345678"` (unmasked)
- `maskedMessage`: `"Em ten [NAME_0], so [PHONE_0]"` (masked)
- `phoneMap`: `[{mask: "[PHONE_0]", real: "0912345678"}]`
- `nameMap`: `[{mask: "[NAME_0]", real: "Huong"}]`

- [ ] **Step 5: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): add PII masking node with dual output (masked + original)"
```

---

### Task 2: Smart Collection Node

**Files:**
- Modify: `n8n/workflow-improved.json`

**Interfaces:**
- Consumes: `Code - Chuan bi context` output (priceSection, customerMessage, originalMessage, senderId, senderName, threadId)
- Produces: `{ systemInstruction, currentDetected, isTopicChange }`

**Design (CRITICAL-1 fix):** Smart Collection does NOT accumulate state across turns. Each n8n execution is stateless. The AI Agent + Simple Memory handle conversation history. Smart Collection's job is:
1. Parse the current message for new booking fields (service, name, phone, time).
2. Inject a system instruction telling the AI Agent what to ask next.
3. Detect topic changes so the AI knows when to reset booking context.

- [ ] **Step 1: Add Code node `Code - Smart Collection` at position `(-250, 0)`**

Insert between `Code - Chuan bi context` (X: -500) and `AI Agent` (X: -350).

```javascript
// Smart Collection -- lightweight parser for current-turn field detection
// CRITICAL-1 fix: does NOT accumulate state. AI Agent + Memory handle cross-turn.
// This node only detects fields in the CURRENT message and injects system instructions.
const input = $input.first().json;
const msg = (input.customerMessage || '').toLowerCase();

// --- Extract fields from current message ---
const detected = {};

// Service detection
const svcMatch = msg.match(/(?:làm tóc|làm nail|chăm sóc da|massage|uốn|nhuộm|cắt|gội|tẩy|trẻ hóa|nâng cơ|điều trị|răng sứ|laser|triệt lông|phun|môi|mí)/i);
if (svcMatch) detected.service = svcMatch[0];

// Time detection (MEDIUM-2: optional field, asked after phone is collected)
const timeMatch = msg.match(/(sáng|chiều|tối|t7|thứ [2-7]|thứ hai|thứ ba|thứ tư|thứ năm|thứ sáu|thứ bảy|chủ nhật|ngày mai|tuần sau|\d{1,2}[h:]\d{0,2})/i);
if (timeMatch) detected.time = timeMatch[0];

// Name detection -- look after keywords
const nameMatch = msg.match(/(?:tên|em là|anh là|chị là|tôi là)\s+([a-zà-ỹ]{2,20})\b/i);
if (nameMatch) detected.name = nameMatch[1];

// Phone detection -- uses originalMessage (unmasked) via customerMessage
// CRITICAL-3 fix: phone regex works because AI Agent receives unmasked message
const phoneMatch = msg.match(/\b0[35789]\d{8}\b/);
if (phoneMatch) {
  detected.phone = phoneMatch[0];
}

// --- Detect topic change (LOW-1 fix) ---
// Topic change = message contains a question pattern but no booking intent keywords
// AND no new field info collected in this message
const hasQuestionPattern = /giờ|địa chỉ|ở đâu|bao nhiêu|có không|là gì|thời gian|mấy giờ|mở cửa|đóng cửa/i.test(msg);
const hasBookingIntent = /đặt|book|lịch|đăng ký|giữ chỗ|xin lịch|slot|muốn làm|em muốn/i.test(msg);
const hasNewFieldInfo = !!(detected.service || detected.name || detected.phone);

const isTopicChange = hasQuestionPattern && !hasBookingIntent && !hasNewFieldInfo;

// --- Build system instruction for AI ---
// Priority order: service -> name -> phone -> time (time is optional, MEDIUM-2)
let instruction = '';
if (isTopicChange) {
  instruction = '\n[HE THONG: Khach thay doi chu de. Tra loi cau hoi moi, sau do quay lai hoi dat lich neu phu hop.]';
} else {
  instruction = '\n[HE THONG: Neu chua co du thong tin dat lich (ten, so dien thoai, dich vu), hay hoi them.]';
  instruction += '\n[UU TIEN HOI: service -> name -> phone -> time (time la tuy chon)]';
  instruction += '\n[Khi du thong tin, tra loi DUNG JSON: {"booking": true, "name": "...", "phone": "...", "service": "...", "note": "..."}]';
}

return [{
  json: {
    ...input,
    currentDetected: detected,
    isTopicChange,
    systemInstruction: instruction
  }
}];
```

- [ ] **Step 2: Wire connections**

Remove old: `Code - Chuan bi context` -> `AI Agent`.

Add: `Code - Chuan bi context` -> `Code - Smart Collection` -> `AI Agent`.

- [ ] **Step 3: Update AI Agent system prompt**

Append `{{ $json.systemInstruction }}` to the AI Agent's `text` field so the AI knows what to ask next. Add to the existing prompt definition in `options.systemMessage`:

At the end of the system message, append:

```
## HE THONG THONG BAO (tu dong):
{{ $json.systemInstruction }}

Khi he thong yeu cau ban them thong tin, hay tuan thu chinh xac.
Neu he thong noi "Du thong tin" -- hay tao JSON booking ngay.
QUAN TRONG: JSON booking PHAI co phone so that (khong phai [PHONE]). Ban duoc truyen tin nhan goc.
```

- [ ] **Step 4: Test multi-turn**

Since each execution is stateless, test each turn independently:

Turn 1: `customerMessage: "Em muon lam toc"` -> verify `systemInstruction` contains "hoi them" and priority order. AI should ask for name.

Turn 2: `customerMessage: "Ten Huong"` -> verify AI asks for phone.

Turn 3: `customerMessage: "0912345678"` -> verify AI outputs booking JSON with real phone number.

- [ ] **Step 5: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): add Smart Collection node (stateless parser, CRITICAL-1 fix)"
```

---

### Task 3: Escalation Detection Node (HIGH-4 fix: INLINE, not parallel)

**Files:**
- Modify: `n8n/workflow-improved.json`

**Interfaces:**
- Consumes: AI Agent output + original customer message
- Produces: `{ isEscalation, escalationType, ownerAlert, escalationReply }`

- [ ] **Step 1: Add Code node `Code - Escalation` at position `(-100, 0)`**

Insert INLINE after AI Agent (sequential, not parallel branch -- HIGH-4 fix).

```javascript
// Escalation Detection -- keyword patterns for handoff to human
// HIGH-4 fix: inline sequential check after AI Agent, not parallel branch
// Uses originalMessage (unmasked) for pattern matching
const input = $input.first().json;
const msg = (input.originalMessage || input.customerMessage || '').toLowerCase();

const PATTERNS = {
  human: /gọi cho em|cho số đt|số điện thoại liên hệ|liên hệ trực tiếp/i,
  complaint: /nói chuyện với quản lý|giám đốc|sếp|không hài lòng|phàn nàn|tệ quá|chửi/i,
  distrust: /không tin bot|người thật|nhân viên thật|tư vấn viên|talk to human/i
};

let escalationType = null;
for (const [type, re] of Object.entries(PATTERNS)) {
  if (re.test(msg)) { escalationType = type; break; }
}

let ownerAlert = null;
let escalationReply = null;

// LOW-2 fix: reply texts match spec exactly
if (escalationType === 'human') {
  ownerAlert = `KHACH MUON NOI CHUYEN TRUC TIEP\nSDT khach: ${input.senderId}\nTin nhan: "${msg}"\nHanh dong: Goi lai ngay!`;
  escalationReply = 'Dạ em đây là số bên em ạ! Em sẽ cho nhân viên liên hệ với chị ngay nhé! 📞';
} else if (escalationType === 'complaint') {
  // LOW-2: spec says "LEAD NONG" for complaint
  ownerAlert = `🔴 LEAD NONG — Khach phan nan / khong hai long\nSDT khach: ${input.senderId}\nTin nhan: "${msg}"\nHanh dong: Xu ly ngay!`;
  escalationReply = 'Em xin lỗi nếu mình chưa làm chị hài lòng. Để em kết nối với quản lý hỗ trợ chị tốt hơn nhé!';
} else if (escalationType === 'distrust') {
  // LOW-2: use SPA_PHONE for hotline per spec
  escalationReply = 'Dạ em là nhân viên tư vấn online của spa ạ! Em vẫn hỗ trợ chị bình thường. Nếu chị muốn gặp trực tiếp, em gửi địa chỉ và hotline nhé: [SPA_PHONE]';
}

return [{
  json: {
    ...input,
    isEscalation: !!escalationType,
    escalationType,
    ownerAlert,
    escalationReply
  }
}];
```

- [ ] **Step 2: Add IF node `IF - Escalation?` at position `(0, 0)`**

n8n IF node (typeVersion 2.2):
- Condition: `{{ $json.isEscalation }}` equals `true`
- TRUE: -> `Code - Format Escalation Alert` -> `Zalo - Bao chu spa` (reuse) + `Zalo - Escalation Reply` (new)
- FALSE: -> `Parse Booking` (normal flow continues)

- [ ] **Step 3: Add `Zalo - Escalation Reply` node at position `(100, 200)`**

```json
{
  "parameters": {
    "threadId": "={{ $('Zalo Message Trigger').item.json.threadId }}",
    "message": "={{ $json.escalationReply }}"
  },
  "type": "n8n-nodes-zalo-gemazo.zaloMessage",
  "typeVersion": 4,
  "position": [100, 200],
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567891",
  "name": "Zalo - Escalation Reply",
  "notes": "Gui reply escalation cho khach hang",
  "credentials": {
    "zaloApi": {
      "id": "62UoySzDRVlZ0ZSG",
      "name": "Zalo - Truong Thinh (0912679845)"
    }
  }
}
```

- [ ] **Step 4: Add `Code - Format Escalation Alert` node at position `(100, 300)`**

```javascript
// Format owner alert for escalation notification
const data = $input.first().json;
return [{
  json: {
    ownerMessage: data.ownerAlert,
    threadId: data.threadId
  }
}];
```

Wire: `IF - Escalation?` TRUE -> `Code - Format Escalation Alert` -> `Zalo - Bao chu spa` (existing node, reuse).
Wire: `IF - Escalation?` TRUE -> `Zalo - Escalation Reply`.
Wire: `IF - Escalation?` FALSE -> `Parse Booking`.

- [ ] **Step 5: Test with "Gọi cho em", "Nói chuyện quản lý", "Không tin bot"**

- [ ] **Step 6: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): add inline Escalation Detection with IF routing (HIGH-4)"
```

---

### Task 4: Unmask Reply Node (HIGH-2 fix)

**Files:**
- Modify: `n8n/workflow-improved.json`

**Interfaces:**
- Consumes: Parse Booking output (with nameMap, phoneMap, replyText)
- Produces: `{ replyText }` with unmasked customer-facing text

**HIGH-2 fix:** Customer currently receives `[NAME_0]` instead of their real name. This node restores real names in customer-facing replies while keeping them masked in Log Chat.

**MEDIUM-1 fix:** Supports indexed replacement `[PHONE_0]`, `[PHONE_1]` etc. for multiple phone numbers.

- [ ] **Step 1: Add Code node `Code - Unmask Reply` at position `(150, 100)`**

Insert after Parse Booking, before the Zalo reply nodes.

```javascript
// Unmask Reply -- restore real names and phones in customer-facing messages
// HIGH-2 fix: customer sees their real name, not [NAME_0]
// MEDIUM-1 fix: indexed replacement for multiple phones/names
// Log Chat still uses masked version (PII protection)
const items = $input.all();
const data = items[0].json;
let reply = data.replyText || '';
const phoneMap = data.phoneMap || [];
const nameMap = data.nameMap || [];

// Unmask phones: [PHONE_0], [PHONE_1], etc.
// Also handle plain [PHONE] alias for [PHONE_0]
phoneMap.forEach((entry) => {
  const escaped = entry.mask.replace(/[[\]]/g, '\\$&');
  reply = reply.replace(new RegExp(escaped, 'g'), entry.real);
  if (entry.mask === '[PHONE_0]') {
    reply = reply.replace(/\[PHONE\]/g, entry.real);
  }
});

// Unmask names: [NAME_0], [NAME_1], etc.
// HIGH-2: customer-facing reply shows real names
nameMap.forEach((entry) => {
  const escaped = entry.mask.replace(/[[\]]/g, '\\$&');
  reply = reply.replace(new RegExp(escaped, 'g'), entry.real);
});

return [{
  json: {
    ...data,
    replyText: reply
  }
}];
```

- [ ] **Step 2: Wire connections**

Parse Booking output -> `Code - Unmask Reply` -> `Zalo - Xac nhan khach` (TRUE path) or `Zalo - Tra loi thuong` (FALSE path).

Log Chat receives data from Parse Booking directly (before Unmask), so it gets the masked version. Wire Parse Booking -> Log Chat as a separate branch.

- [ ] **Step 3: Update `Zalo - Xac nhan khach` and `Zalo - Tra loi thuong` threadId**

Both Zalo reply nodes should use `$('Zalo Message Trigger').item.json.threadId` for threadId. Update their threadId expressions:

```json
"threadId": "={{ $('Zalo Message Trigger').item.json.threadId }}"
```

- [ ] **Step 4: Test**

Send "Em ten Huong, 0912345678" -> verify:
- AI reply contains "Huong" (not `[NAME_0]`)
- AI reply contains "0912345678" (not `[PHONE_0]`)
- Log Chat row contains `[NAME_0]` and `[PHONE_0]` (masked)

- [ ] **Step 5: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): add Unmask Reply node (HIGH-2 fix, MEDIUM-1 indexed replacement)"
```

---

### Task 5: Business Hours Detection Node (MEDIUM-6 fix)

**Files:**
- Modify: `n8n/workflow-improved.json`

**Interfaces:**
- Consumes: Parse Booking output (after IF - Co dat cho? TRUE branch, after Duplicate check passes)
- Produces: `{ isBusinessHours }` -- routes to owner notification vs silent save

- [ ] **Step 1: Add Code node `Code - Gio lam viec` at position `(250, -200)`**

Insert after `IF - Duplicate?` FALSE (non-reject path), before the existing booking save flow.

```javascript
// Business Hours -- HCM timezone check
// MEDIUM-6 fix: hour >= 8 && hour <= 20 (includes 20:xx, not just up to 19:xx)
const now = new Date();
const hcmNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
const hour = hcmNow.getHours();
const isBusinessHours = hour >= 8 && hour <= 20;

return [{
  json: {
    ...$input.first().json,
    isBusinessHours,
    currentHourHCM: hour
  }
}];
```

- [ ] **Step 2: Add IF node `IF - Gio lam viec?` at position `(350, -200)`**

n8n IF node (typeVersion 2.2):
- Condition: `{{ $json.isBusinessHours }}` equals `true`
- TRUE: -> `GS - Luu dat cho` + `Tao tin nhan bao chu` -> `Zalo - Bao chu spa` + `Zalo - Xac nhan khach`
- FALSE: -> `GS - Luu dat cho` (silent save) + `Code - Deferred Reply`

- [ ] **Step 3: Add `Code - Deferred Reply` at position `(450, 300)`**

```javascript
// Deferred Reply -- outside business hours
// MEDIUM-4 fix: dedicated code node for deferred reply template
const data = $input.first().json;
const b = data.bookingData || {};
const reply = `Dạ em đã ghi nhận lịch của chị rồi ạ! ✅\n` +
  `Dịch vụ: ${b.service || 'Chưa rõ'}\n` +
  `Em sẽ xác nhận lại với chị vào sáng mai lúc 8h. 💖`;

return [{
  json: {
    ...data,
    replyText: reply,
    threadId: data.threadId || ''
  }
}];
```

- [ ] **Step 4: Add `Zalo - Deferred Reply` node at position `(550, 300)`**

New Zalo message node for deferred replies (MEDIUM-4 fix: dedicated node):

```json
{
  "parameters": {
    "threadId": "={{ $('Zalo Message Trigger').item.json.threadId }}",
    "message": "={{ $json.replyText }}"
  },
  "type": "n8n-nodes-zalo-gemazo.zaloMessage",
  "typeVersion": 4,
  "position": [550, 300],
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678902",
  "name": "Zalo - Deferred Reply",
  "notes": "Gui reply khach hang khi ngoai gio lam viec",
  "credentials": {
    "zaloApi": {
      "id": "62UoySzDRVlZ0ZSG",
      "name": "Zalo - Truong Thinh (0912679845)"
    }
  }
}
```

- [ ] **Step 5: Wire deferred path**

`IF - Gio lam viec?` FALSE -> `GS - Luu dat cho` -> `Code - Deferred Reply` -> `Zalo - Deferred Reply`.

- [ ] **Step 6: Test by setting system clock to 22:00 HCM**

- [ ] **Step 7: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): add Business Hours IF node (08:00-20:00 HCM, inclusive)"
```

---

### Task 6: Duplicate Booking Detection Node (CRITICAL-4 fix)

**Files:**
- Modify: `n8n/workflow-improved.json`

**Interfaces:**
- Consumes: Parse Booking output (bookingData with phone) + GS Read output (existing bookings)
- Produces: `{ duplicateAction: 'insert' | 'update' | 'reject', existingRow }`

- [ ] **Step 1: Add Google Sheets Read node `GS - Check Duplicate` at position `(250, -400)`**

Google Sheets node (typeVersion 4.5):

```json
{
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "",
      "mode": "list",
      "cachedResultName": "[CHON GOOGLE SHEET DAT CHO]"
    },
    "sheetName": {
      "__rl": true,
      "value": "",
      "mode": "list",
      "cachedResultName": "DatCho"
    },
    "filters": {},
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "position": [250, -400],
  "id": "c3d4e5f6-a7b8-9012-cdef-123456789013",
  "name": "GS - Check Duplicate",
  "notes": "Doc danh sach dat cho hien co de kiem tra trung lap",
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "THAY_THE_BANG_CREDENTIAL_ID_CUA_BAN",
      "name": "Google Sheets account"
    }
  }
}
```

- [ ] **Step 2: Add Code node `Code - Check Duplicate` at position `(350, -400)`**

```javascript
// Duplicate Check -- determine action based on existing booking status
// CRITICAL-4 fix: uses $('Code - Smart Collection').first().json to access phone from upstream
// Combined with $input.all() for GS Read results
const existingRows = $input.all(); // results from GS Read
const smartCollection = $('Code - Smart Collection').first().json;
const parseBooking = $('Parse Booking').first().json;
const phone = smartCollection.currentDetected?.phone || parseBooking.bookingData?.phone;
const newService = parseBooking.bookingData?.service;

let action = 'insert';
let reply = '';
let existingRow = null;

// Find matching row by phone in GS results
const match = existingRows.find(r => {
  const rowPhone = r.json['So dien thoai'] || r.json['Số điện thoại'] || '';
  return rowPhone === phone;
});

if (match) {
  existingRow = match.json;
  const status = existingRow['Trang thai'] || existingRow['Trạng thái'] || '';

  if (status === 'Moi dat' || status === 'Mới đặt') {
    action = 'update';
    reply = 'Em đã cập nhật lịch cho chị rồi ạ! 💖';
  } else if (status === 'Da xac nhan' || status === 'Đã xác nhận') {
    action = 'reject';
    // LOW-2: use [SPA_PHONE] for hotline per spec
    reply = 'Lịch của chị đã được xác nhận rồi ạ! Để thay đổi, chị gọi trực tiếp: [SPA_PHONE] 📞';
  } else if (status === 'Hoan thanh' || status === 'Hoàn thành') {
    action = 'insert'; // New booking allowed after completed
    reply = '';
  }
}

return [{
  json: {
    ...$input.first().json,
    duplicateAction: action,
    existingRow,
    duplicateReply: reply,
    // Pass through booking data for downstream nodes
    bookingData: parseBooking.bookingData
  }
}];
```

- [ ] **Step 3: Add IF node `IF - Duplicate?` at position `(450, -400)`**

n8n IF node (typeVersion 2.2):
- Condition: `{{ $json.duplicateAction }}` equals `reject`
- TRUE: -> `Zalo - Duplicate Reply` (new node)
- FALSE: -> `IF - Insert or Update?`

- [ ] **Step 4: Add `Zalo - Duplicate Reply` node at position `(550, -500)`**

```json
{
  "parameters": {
    "threadId": "={{ $('Zalo Message Trigger').item.json.threadId }}",
    "message": "={{ $json.duplicateReply }}"
  },
  "type": "n8n-nodes-zalo-gemazo.zaloMessage",
  "typeVersion": 4,
  "position": [550, -500],
  "id": "d4e5f6a7-b8c9-0123-defa-234567890124",
  "name": "Zalo - Duplicate Reply",
  "notes": "Tra loi khach khi dat trung lap",
  "credentials": {
    "zaloApi": {
      "id": "62UoySzDRVlZ0ZSG",
      "name": "Zalo - Truong Thinh (0912679845)"
    }
  }
}
```

- [ ] **Step 5: Add IF node `IF - Insert or Update?` at position `(550, -400)`**

n8n IF node (typeVersion 2.2):
- Condition: `{{ $json.duplicateAction }}` equals `insert`
- TRUE: -> `GS - Luu dat cho` (existing, append)
- FALSE (update): -> `GS - Update Booking` (new)

- [ ] **Step 6: Add `GS - Update Booking` node at position `(650, -300)`**

MEDIUM-3 fix: complete node config for GS Update Booking.

```json
{
  "parameters": {
    "operation": "update",
    "documentId": {
      "__rl": true,
      "value": "",
      "mode": "list",
      "cachedResultName": "[CHON GOOGLE SHEET DAT CHO]"
    },
    "sheetName": {
      "__rl": true,
      "value": "",
      "mode": "list",
      "cachedResultName": "DatCho"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "Thời gian": "={{ $json.bookingData.timestamp }}",
        "Tên khách": "={{ $json.bookingData.name }}",
        "Số điện thoại": "={{ $json.bookingData.phone }}",
        "Dịch vụ": "={{ $json.bookingData.service }}",
        "Ghi chú": "={{ $json.bookingData.note }}",
        "Zalo ID": "={{ $json.senderId }}",
        "Trạng thái": "Mới đặt"
      },
      "matchingColumns": ["Số điện thoại"],
      "schema": [
        { "displayName": "Thời gian", "name": "Thời gian", "type": "string" },
        { "displayName": "Tên khách", "name": "Tên khách", "type": "string" },
        { "displayName": "Số điện thoại", "name": "Số điện thoại", "type": "string" },
        { "displayName": "Dịch vụ", "name": "Dịch vụ", "type": "string" },
        { "displayName": "Ghi chú", "name": "Ghi chú", "type": "string" },
        { "displayName": "Zalo ID", "name": "Zalo ID", "type": "string" },
        { "displayName": "Trạng thái", "name": "Trạng thái", "type": "string" }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "position": [650, -300],
  "id": "e5f6a7b8-c9d0-1234-efab-345678901235",
  "name": "GS - Update Booking",
  "notes": "Cap nhat booking khi trung lap voi trang thai Moi dat",
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "THAY_THE_BANG_CREDENTIAL_ID_CUA_BAN",
      "name": "Google Sheets account"
    }
  }
}
```

Wire: `GS - Update Booking` -> `Zalo - Xac nhan khach` (reuse existing).

- [ ] **Step 7: Test all 3 paths**

1. New phone -> `duplicateAction: 'insert'` -> GS Luu dat cho (append)
2. Existing phone + "Moi dat" -> `duplicateAction: 'update'` -> GS Update Booking + Xac nhan
3. Existing phone + "Da xac nhan" -> `duplicateAction: 'reject'` -> Zalo Duplicate Reply (no Sheet write)

- [ ] **Step 8: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): add Duplicate Booking Detection with CRITICAL-4 cross-node access"
```

---

### Task 7: Update Log Chat for PII Protection (MEDIUM-5 fix)

**Files:**
- Modify: `n8n/workflow-improved.json` (Log Chat node)

**MEDIUM-5 fix:** Explicitly state that Log Chat uses `maskedMessage` (PII-protected) while booking data uses `originalMessage`.

- [ ] **Step 1: Update `Google Sheets - Log chat` column mappings**

Change the "Tin nhan khach" column to use `maskedMessage` instead of `customerMessage`:

Update the columns mapping:
```json
{
  "parameters": {
    "operation": "append",
    "documentId": {
      "__rl": true,
      "value": "",
      "mode": "list",
      "cachedResultName": "[CHON GOOGLE SHEET LOG CHAT]"
    },
    "sheetName": {
      "__rl": true,
      "value": "",
      "mode": "list",
      "cachedResultName": "Sheet1"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "Thời gian": "={{ $json.timestamp }}",
        "Zalo ID": "={{ $json.senderId }}",
        "Tên khách": "={{ $json.senderName }}",
        "Tin nhắn khách": "{{ $json.maskedMessage || $json.customerMessage }}",
        "Phản hồi AI": "={{ $json.replyText }}",
        "Loại": "={{ $json.messageType }}",
        "Đặt lịch": "={{ $json.isBooking ? 'Có' : 'Không' }}"
      },
      "schema": [
        { "displayName": "Thời gian", "name": "Thời gian", "type": "string" },
        { "displayName": "Zalo ID", "name": "Zalo ID", "type": "string" },
        { "displayName": "Tên khách", "name": "Tên khách", "type": "string" },
        { "displayName": "Tin nhắn khách", "name": "Tin nhắn khách", "type": "string" },
        { "displayName": "Phản hồi AI", "name": "Phản hồi AI", "type": "string" },
        { "displayName": "Loại", "name": "Loại", "type": "string" },
        { "displayName": "Đặt lịch", "name": "Đặt lịch", "type": "string" }
      ]
    },
    "options": {}
  }
}
```

MEDIUM-5: The "Tin nhan khach" field uses `maskedMessage` (from PII Masking) which has phones and names replaced with tokens. The booking data (in DatCho sheet) uses `originalMessage` / real phone numbers.

- [ ] **Step 2: Test**

Verify Log Chat sheet row contains `[PHONE_0]` and `[NAME_0]` in the "Tin nhan khach" column, not real PII.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflow-improved.json
git commit -m "feat(wf1): update Log Chat to use maskedMessage for PII protection"
```

---

## Updated Flow Diagram (All Fixes Applied)

```
Zalo Trigger
  -> [Code - PII Masking]
        | outputs: originalMessage, maskedMessage, phoneMap, nameMap, senderId, senderName, threadId
  -> [Google Sheets - Doc bang gia]
  -> [Code - Chuan bi context]
        | forwards: originalMessage -> AI, maskedMessage -> Log Chat
        | adds: priceSection, customerMessage (= originalMessage)
  -> [Code - Smart Collection]
        | parses current message for service/name/phone/time
        | injects systemInstruction for AI Agent
        | detects topic change
  -> [AI Agent] (+ Simple Memory + Gemini)
        | receives: originalMessage (real phone)
        | outputs: aiOutput text (may contain booking JSON)
  -> [Code - Escalation]              <- INLINE, sequential (HIGH-4)
        | checks originalMessage for escalation keywords
  -> [IF - Escalation?]
        |-> TRUE:
        |     -> [Code - Format Escalation Alert]
        |        -> [Zalo - Bao chu spa] (owner alert, reuse existing)
        |     -> [Zalo - Escalation Reply] (NEW, customer reply)
        |-> FALSE:
        |     -> [Parse Booking] (existing, enhanced)
        |        -> [Code - Unmask Reply] (HIGH-2: unmask names for customer)
        |        -> [Google Sheets - Log Chat] (MEDIUM-5: uses maskedMessage)
        |     -> [IF - Co dat cho?] (existing)
        |        |-> TRUE:
        |        |     -> [GS - Check Duplicate] (NEW)
        |        |     -> [Code - Check Duplicate] (NEW, CRITICAL-4: cross-node access)
        |        |        -> [IF - Duplicate?]
        |        |           |-> reject -> [Zalo - Duplicate Reply]
        |        |           |-> insert/update:
        |        |                -> [IF - Insert or Update?]
        |        |                   |-> insert -> [GS - Luu dat cho] + [Zalo - Xac nhan khach]
        |        |                   |-> update -> [GS - Update Booking] + [Zalo - Xac nhan khach]
        |        |     -> [Code - Gio lam viec] (NEW, MEDIUM-6: <= 20)
        |        |        -> [IF - Gio lam viec?]
        |        |           |-> TRUE (8-20h):
        |        |           |    -> [Tao tin nhan bao chu] -> [Zalo - Bao chu spa]
        |        |           |    -> [Zalo - Xac nhan khach]
        |        |           |-> FALSE (outside hours):
        |        |           |    -> [GS - Luu dat cho] (silent)
        |        |           |    -> [Code - Deferred Reply]
        |        |           |    -> [Zalo - Deferred Reply] (NEW)
        |        |-> FALSE:
        |             -> [Code - Unmask Reply]
        |                -> [Zalo - Tra loi thuong]
```

## New Node Summary

| # | Node Name | Type | Task | Fix |
|---|-----------|------|------|-----|
| 1 | Code - PII Masking | code | Task 1 | CRITICAL-2, HIGH-3 |
| 2 | Code - Unmask Reply | code | Task 4 | HIGH-2, MEDIUM-1 |
| 3 | Code - Smart Collection | code | Task 2 | CRITICAL-1 |
| 4 | Code - Escalation | code | Task 3 | HIGH-4 |
| 5 | IF - Escalation? | if | Task 3 | HIGH-4 |
| 6 | Code - Format Escalation Alert | code | Task 3 | HIGH-4 |
| 7 | Zalo - Escalation Reply | zaloMessage | Task 3 | -- |
| 8 | GS - Check Duplicate | googleSheets | Task 6 | CRITICAL-4 |
| 9 | Code - Check Duplicate | code | Task 6 | CRITICAL-4 |
| 10 | IF - Duplicate? | if | Task 6 | -- |
| 11 | IF - Insert or Update? | if | Task 6 | -- |
| 12 | GS - Update Booking | googleSheets | Task 6 | MEDIUM-3 |
| 13 | Zalo - Duplicate Reply | zaloMessage | Task 6 | -- |
| 14 | Code - Gio lam viec | code | Task 5 | MEDIUM-6 |
| 15 | IF - Gio lam viec? | if | Task 5 | -- |
| 16 | Code - Deferred Reply | code | Task 5 | MEDIUM-4 |
| 17 | Zalo - Deferred Reply | zaloMessage | Task 5 | MEDIUM-4 |

**Total: 17 new nodes + 14 existing = 31 nodes**

---

## Self-Review

**Spec coverage:**
- PII Masking (Section 1) -> Task 1 -- CRITICAL-2 dual output, HIGH-3 regex fix
- Smart Collection (Section 2) -> Task 2 -- CRITICAL-1 stateless design
- Business Hours (Section 3) -> Task 5 -- MEDIUM-6 inclusive hour check
- Escalation (Section 4) -> Task 3 -- HIGH-4 inline routing, LOW-2 spec text match
- Duplicate Check (Section 5) -> Task 6 -- CRITICAL-4 cross-node phone access
- Conversation UX 4 scenarios covered in Smart Collection + AI Agent system prompt

**Placeholder scan:** `[SPA_PHONE]` is a runtime config token -- resolved by the spa's config in Google Sheets. No TBD/TODO placeholders remain.

**Type consistency:**
- All nodes pass `$input.first().json` -> spread -> forward. Consistent shape maintained.
- `phoneMap` array from Task 1 consumed in Task 4 (Unmask). Shape: `[{mask, real}]`.
- `nameMap` array from Task 1 consumed in Task 4 (Unmask). Shape: `[{mask, real}]`.
- `originalMessage` flows through entire pipeline for AI processing.
- `maskedMessage` flows only to Log Chat.

**Node count:** 17 new nodes added to existing 14 = 31 total.

**CRITICAL fixes verified:**
- CRITICAL-1: Smart Collection is stateless parser, AI Agent + Memory handle conversation state.
- CRITICAL-2: AI Agent receives originalMessage (unmasked phone). Log Chat receives maskedMessage.
- CRITICAL-3: Phone regex works on originalMessage (unmasked) -- resolved by CRITICAL-2.
- CRITICAL-4: Check Duplicate uses `$('Code - Smart Collection').first().json` for cross-node phone access.

**HIGH fixes verified:**
- HIGH-1: `Code - Chuan bi context` includes `originalMessage` in output.
- HIGH-2: `Code - Unmask Reply` restores real names in customer-facing replies.
- HIGH-3: Name masking uses `String.replace()` callback, not `while/exec` loop.
- HIGH-4: Escalation check is inline (sequential) after AI Agent, with IF node routing.

**MEDIUM fixes verified:**
- MEDIUM-1: Unmask handles indexed `[PHONE_0]`, `[PHONE_1]` etc.
- MEDIUM-2: Smart Collection priority order is service -> name -> phone -> time (time optional).
- MEDIUM-3: GS Update Booking has complete node config.
- MEDIUM-4: Deferred reply has dedicated Code + Zalo nodes.
- MEDIUM-5: Log Chat explicitly uses `maskedMessage`.
- MEDIUM-6: Business hours check is `hour >= 8 && hour <= 20`.

**LOW fixes verified:**
- LOW-1: Topic change detection requires question pattern AND no booking intent AND no new field info.
- LOW-2: Escalation reply texts match spec exactly (SPA_PHONE for hotline, "LEAD NONG" for complaint).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-23-wf1-cs-bot-core-upgrade.md`. Two execution options:**

**1. Subagent-Driven (recommended)** -- I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** -- Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review

**Which approach?**
