# Prompt Setup Google Sheets Multi-Tenant — Ghost Worker v3

## Mục đích

Thiết lập multi-tenant isolation cho Ghost Worker v3 (WF1 CS Bot). Mỗi spa chỉ thấy data của mình thông qua cột `spa_id`.

Workflow n8n đọc ghi dữ liệu vào 3 Google Sheets:
1. **DatCho** — Lưu thông tin đặt lịch của khách hàng
2. **LogChat** — Ghi log mọi cuộc hội thoại với AI
3. **BangGia** — Bảng giá dịch vụ của spa

Mỗi sheet cần thêm cột `spa_id` ở vị trí đầu tiên (cột A), và workflow cần cấu hình static data để xác định spa đang hoạt động.

---

## PHẦN 1: Cấu trúc Google Sheets SAU KHI CẬP NHẬT

### Sheet 1: DatCho (Đặt Chỗ)

Cột `spa_id` là cột đầu tiên. Tất cả các cột khác bị đẩy sang phải.

| Cột | Kí hiệu | Kiểu dữ liệu | Ghi chú |
|-----|---------|-------------|---------|
| A | spa_id | Text | Cột mới — giá trị mặc định: `default-spa` |
| B | Thời gian | Text | Ngày giờ đặt lịch (format: vi-VN) |
| C | Tên khách | Text | Họ tên khách hàng |
| D | Số điện thoại | Text | Số điện thoại Zalo |
| E | Dịch vụ | Text | Tên dịch vụ (VD: làm tóc, massage...) |
| F | Ghi chú | Text | Ghi chú thêm của khách |
| G | Zalo ID | Text | Zalo user ID của khách |
| H | Trạng thái | Text | Mới đặt / Đã xác nhận / Hoàn thành |

**Cấu trúc cũ (trước khi thêm):**

| B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|
| Thời gian | Tên khách | Số điện thoại | Dịch vụ | Ghi chú | Zalo ID | Trạng thái |

**Cấu trúc mới (sau khi thêm):**

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| spa_id | Thời gian | Tên khách | Số điện thoại | Dịch vụ | Ghi chú | Zalo ID | Trạng thái |

**Nodes n8n sử dụng sheet này:**
- `GS - Check Duplicate` — đọc và filter theo `spa_id` + `Số điện thoại`
- `GS - Lưu đặt chỗ` — append mới với `spa_id`
- `GS - Update Booking` — cập nhật theo matching `spa_id` + `Số điện thoại`

---

### Sheet 2: LogChat (Log Chat)

Cột `spa_id` là cột đầu tiên.

| Cột | Kí hiệu | Kiểu dữ liệu | Ghi chú |
|-----|---------|-------------|---------|
| A | spa_id | Text | Cột mới — giá trị mặc định: `default-spa` |
| B | Thời gian | Text | Thời gian gửi nhắn |
| C | Zalo ID | Text | Zalo user ID của khách |
| D | Tên khách | Text | Tên hiển thị trên Zalo |
| E | Tin nhắn khách | Text | Nội dung tin nhắn (đã mask PII) |
| F | Phản hồi AI | Text | Trả lời từ AI Agent |
| G | Loại | Text | Tư vấn / Đặt lịch / Hỏi giá / Phàn nàn / Hỏi thông tin |
| H | Đặt lịch | Text | Có / Không |

**Cấu trúc cũ (trước khi thêm):**

| B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|
| Thời gian | Zalo ID | Tên khách | Tin nhắn khách | Phản hồi AI | Loại | Đặt lịch |

**Cấu trúc mới (sau khi thêm):**

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| spa_id | Thời gian | Zalo ID | Tên khách | Tin nhắn khách | Phản hồi AI | Loại | Đặt lịch |

**Nodes n8n sử dụng sheet này:**
- `Google Sheets - Log chat` — append mới với `spa_id`

---

### Sheet 3: BangGia (Bảng Giá / Services & Pricing)

Cột `spa_id` là cột đầu tiên.

| Cột | Kí hiệu | Kiểu dữ liệu | Ghi chú |
|-----|---------|-------------|---------|
| A | spa_id | Text | Cột mới — giá trị mặc định: `default-spa` |
| B | Dịch vụ | Text | Tên dịch vụ (VD: Làm tóc nam, Chăm sóc da...) |
| C | Giá | Text | Giá tiền (VD: 150.000đ, Từ 200k...) |
| D | Mô tả | Text | Mô tả dịch vụ (tùy chọn) |

**Cấu trúc cũ (trước khi thêm):**

| B | C | D |
|---|---|---|
| Dịch vụ | Giá | Mô tả |

**Cấu trúc mới (sau khi thêm):**

| A | B | C | D |
|---|---|---|---|
| spa_id | Dịch vụ | Giá | Mô tả |

**Lưu ý quan trọng:** Node `Google Sheets - Đọc bảng giá` hiện tại đọc TẤT CẢ rows (không filter theo spa_id). Có thể thêm filter ở step 5 bên dưới. Tuy nhiên, với giai đoạn `default-spa` thì không bắt buộc — workflow vẫn hoạt động bình thường.

**Nodes n8n sử dụng sheet này:**
- `Google Sheets - Đọc bảng giá` — đọc bảng giá để đưa vào prompt AI

---

## PHẦN 2: Hướng dẫn thực thi từng bước

### Bước 1: Thêm cột spa_id vào sheet DatCho

1. Mở Google Sheets chứa sheet DatCho
2. Nhấn chuột trên cột A (cột đầu tiên hiện có — "Thời gian")
3. Chọn **Insert 1 column to the left** (Chèn 1 cột sang bên trái)
4. Ở cell **A1** (header), nhập: `spa_id`
5. Qua tất cả các hàng đã có dữ liệu (từ A2 xuống dưới):
   - Nếu sheet có 50 hàng dữ liệu → điền `default-spa` từ A2 đến A51
   - Nhanh nhất: nhập `default-spa` vào A2, copy, chọn tất cả hàng còn lại, paste
6. Kiểm tra: header row phải là `spa_id | Thời gian | Tên khách | Số điện thoại | Dịch vụ | Ghi chú | Zalo ID | Trạng thái`

**Lưu ý:**
- KHÔNG xóa bất kỳ cột nào
- KHÔNG sửa dữ liệu trong các cột có sẵn
- Chỉ CHÈN một cột mới ở vị trí đầu tiên

---

### Bước 2: Thêm cột spa_id vào sheet LogChat

1. Mở Google Sheets chứa sheet LogChat
2. Nhấn chuột trên cột A (cột đầu tiên hiện có — "Thời gian")
3. Chọn **Insert 1 column to the left**
4. Ở cell **A1** (header), nhập: `spa_id`
5. Điền `default-spa` cho tất cả hàng đã có dữ liệu
6. Kiểm tra: header row phải là `spa_id | Thời gian | Zalo ID | Tên khách | Tin nhắn khách | Phản hồi AI | Loại | Đặt lịch`

---

### Bước 3: Thêm cột spa_id vào sheet BangGia

1. Mở Google Sheets chứa sheet BangGia
2. Nhấn chuột trên cột A (cột đầu tiên hiện có — "Dịch vụ")
3. Chọn **Insert 1 column to the left**
4. Ở cell **A1** (header), nhập: `spa_id`
5. Điền `default-spa` cho tất cả hàng đã có dữ liệu
6. Kiểm tra: header row phải là `spa_id | Dịch vụ | Giá | Mô tả`

---

### Bước 4: Cấu hình Static Data trong n8n Workflow

Node `Code - PII Masking` đọc `spaId` từ workflow static data:

```javascript
const staticData = $getWorkflowStaticData('global');
const spaId = staticData.spaId || 'default-spa';
```

**Cách cấu hình:**

1. Mở workflow `CS Zalo - Ghost Worker v3` trong n8n
2. Nhấn vào nút **Settings** (hoặc phim `.`) để mở workflow settings
3. Tìm mục **Static Data** (hoặc chỉnh sửa trực tiếp trong JSON)
4. Thiết lập như sau:

**Option A — Qua giao diện n8n (nếu hỗ trợ):**
- Mở workflow settings
- Tìm "Workflow Static Data"
- Thêm key: `spaId`, value: `default-spa`

**Option B — Qua JSON (chính xác nhất):**

Trong file workflow JSON, tìm `staticData` hiện có:

```json
"staticData": {
  "node:Zalo Message Trigger": {
    "isConnected": true
  },
  "spaId": "default-spa"
}
```

**Lưu ý:**
- Giá trị `spaId` phải phù hợp với giá trị dùng trong cột `spa_id` của Google Sheets
- Mặc định là `default-spa`
- Khi thêm spa mới, thay đổi giá trị này thành ID của spa đó (VD: `spa-hoang-anh`, `spa-thu-ha`)
- **Mỗi spa cần 1 workflow riêng với spaId riêng**, hoặc dùng một workflow chung với cơ chế filter

---

### Bước 5 (Tùy chọn): Thêm filter spa_id vào node đọc BangGia

Hiện tại node `Google Sheets - Đọc bảng giá` đọc tất cả rows. Để multi-tenant chính xác:

1. Mở node `Google Sheets - Đọc bảng giá` trong n8n
2. Tìm phần **Filters**
3. Thêm filter mới:
   - Field: `spa_id`
   - Operator: `equals`
   - Value: `={{ $('Code - Chuẩn bị context').first().json.spaId }}`
4. Lưu node

**Lưu ý:** Nếu sheet BangGia chỉ có 1 spa duy nhất thì không cần filter này. Chỉ áp dụng khi có nhiều spa chung sheet.

---

## PHẦN 3: Cấu hình cho Spa Mới (Multi-Tenant)

Khi thêm một spa mới vào hệ thống:

### Bước A: Thêm data mới vào Google Sheets

1. Mở sheet **BangGia** → thêm các hàng dịch vụ của spa mới, với cột `spa_id` là ID của spa đó (VD: `spa-hoang-anh`)
2. Mở sheet **DatCho** → khi có booking mới từ spa đó, `spa_id` sẽ tự động được điền bởi workflow
3. Mở sheet **LogChat** → khi có chat mới từ spa đó, `spa_id` sẽ tự động được điền bởi workflow

### Bước B: Copy và cấu hình workflow mới

1. Trong n8n, duplicate workflow `CS Zalo - Ghost Worker v3`
2. Đổi tên thành `CS Zalo - [Tên Spa]`
3. Vào Settings → Static Data → đổi `spaId` thành ID spa mới (VD: `spa-hoang-anh`)
4. Cấu hình Zalo credentials mới (nếu spa mới có Zalo riêng)
5. Activate workflow mới

---

## PHẦN 4: Checklist Xác Nhận

Trước khi deploy, kiểm tra TẤT CẢ:

### Google Sheets
- [ ] Sheet **DatCho**: cột A là `spa_id`, header row đúng cấu trúc
- [ ] Sheet **DatCho**: tất cả hàng hiện có có giá trị `spa_id`
- [ ] Sheet **LogChat**: cột A là `spa_id`, header row đúng cấu trúc
- [ ] Sheet **LogChat**: tất cả hàng hiện có có giá trị `spa_id`
- [ ] Sheet **BangGia**: cột A là `spa_id`, header row đúng cấu trúc
- [ ] Sheet **BangGia**: tất cả hàng hiện có có giá trị `spa_id`

### n8n Workflow
- [ ] Node `Code - PII Masking` có `$getWorkflowStaticData('global')` và đọc `spaId`
- [ ] Workflow static data có key `spaId` với giá trị đúng (VD: `default-spa`)
- [ ] Node `GS - Check Duplicate` filter theo `spa_id`
- [ ] Node `GS - Lưu đặt chỗ` ghi cột `spa_id` khi append
- [ ] Node `GS - Update Booking` ghi cột `spa_id` khi update
- [ ] Node `Google Sheets - Log chat` ghi cột `spa_id` khi append
- [ ] Tất cả Google Sheets credentials đã được thay bằng credential thật (không còn placeholder `THAY_THE_BANG_CREDENTIAL_ID_CUA_BAN`)

### Test Flow
- [ ] Gửi tin nhắn test: `"Em muốn làm tóc"` → verify AI trả lời hỏi tên
- [ ] Gửi tin nhắn test: `"Tên Hương"` → verify AI trả lời hỏi SĐT
- [ ] Gửi tin nhắn test: `"0912345678"` → verify booking được tạo với SĐT thật trong sheet DatCho
- [ ] Kiểm tra sheet DatCho: hàng mới có `spa_id` = giá trị đã cấu hình
- [ ] Kiểm tra sheet LogChat: hàng mới có `spa_id` và tin nhắn đã mask PII
- [ ] Gửi tin nhắn test: `"Gọi cho em"` → verify escalation được trigger
- [ ] Gửi tin nhắn test: `"Nói chuyện quản lý"` → verify owner nhận được alert 🔴

---

## PHẦN 5: Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|------|------------|----------|
| `spaId` trả về `undefined` | Chưa cấu hình static data | Thêm key `spaId` vào workflow static data |
| Cột `spa_id` không khớp | Google Sheet header có dấu khác với code | Đảm bảo header trong sheet là `spa_id` (không dấu, có gạch dưới) |
| Filter `spa_id` không hoạt động | Node filter sử dụng expression sai | Kiểm tra expression `{{ $('Code - Chuẩn bị context').first().json.spaId }}` |
| Credential placeholder | Chưa thay `THAY_THE_BANG_CREDENTIAL_ID_CUA_BAN` | Thay bằng credential ID thật trong tất cả 7 nodes Google Sheets |
| PII bị lộ trong reply | Node Unmask hoạt động sai | Kiểm tra `phoneMap` và `nameMap` được forward đúng từ PII Masking |
| Data leak giữa các spa | Không có filter spa_id trên GS Read | Thêm filter spa_id vào tất cả nodes đọc Google Sheets |

---

## PHẦN 6: Template Prompt cho Agent

Sử dụng prompt này để gửi cho AI Agent hoặc người vận hành:

```
Bạn là Google Sheets automation agent. Nhiệm vụ: thêm cột spa_id vào tất cả sheets của Ghost Worker v3.

YÊU CẦU CỤ THỂ:
1. Mở sheet DatCho → chèn cột spa_id ở vị trí A1 (đầu tiên) → điền "default-spa" cho tất cả rows hiện có
2. Mở sheet LogChat → chèn cột spa_id ở vị trí A1 (đầu tiên) → điền "default-spa" cho tất cả rows hiện có  
3. Mở sheet BangGia → chèn cột spa_id ở vị trí A1 (đầu tiên) → điền "default-spa" cho tất cả rows hiện có

QUY TẮC BẮT BUỘC:
- KHÔNG xóa hay sửa dữ liệu hiện có
- Chỉ thêm cột spa_id ở vị trí đầu tiên
- Giá trị mặc định cho hàng hiện có: "default-spa"
- Header mới phải chính xác: spa_id (viết liền, có gạch dưới, không dấu)

SAU KHI HOÀN THÀNH:
- Đọc lại header row của mỗi sheet để xác nhận
- Liệt kê số rows đã cập nhật
- Báo cáo lỗi (nếu có)

OUTPUT MONG ĐỢI:
- Danh sách các sheets đã cập nhật
- Cấu trúc header mới của mỗi sheet (trước và sau)
- Số rows đã được cập nhật
- Trạng thái: THÀNH CÔNG / THẤT BẠI
```

---

## PHẦN 7: Lưu Ý Quan Trọng

1. **Mỗi spa cần 1 workflow riêng** hoặc 1 workflow chung với filter spa_id chặt chẽ
2. **Không dùng dấu tiếng Việt trong spaId** (VD: dùng `spa-hoang-anh` thay vì `spa-hoàng-anh`)
3. **Backup Google Sheets** trước khi thêm cột
4. **Static data trong n8n** được lưu trên server, không mất khi restart workflow
5. **Credential Google Sheets** phải được cấu hình cho TẤT CẢ 7 nodes trước khi deploy
