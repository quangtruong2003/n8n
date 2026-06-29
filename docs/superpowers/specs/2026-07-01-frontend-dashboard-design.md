# Spec Thiết Kế: Frontend Dashboard Refactoring

> **Dự án:** GHOST-WORKER  
> **Ngày:** 2026-07-01  
> **Trạng thái:** Brainstorming Design  
> **Backend APIs tương thích:** Plan A (Auth/Tenant/CRUD) + Plan B (Chatbot/Zalo)

---

## 1. Mục Tiêu & Bối Cảnh
Dự án đã di chuyển từ cấu trúc single-tenant (1 Spa đơn lẻ, đăng nhập bằng PIN) lên cấu trúc **universal multi-tenant** (nhiều doanh nghiệp dùng chung 23 bảng, phân quyền 3 cấp Super Admin -> Owner -> Staff).
Mục tiêu là tái cấu trúc lại Frontend Dashboard để:
1. Đồng bộ hoàn toàn với cơ chế JWT Auth, User & Tenant data mới.
2. Thêm các view mới phục vụ nghiệp vụ bán hàng/đặt lịch mới (Orders, Staff, Roles).
3. Nâng cấp Chat Panel thành Chat Dashboard quản lý Zalo & Web Chat tập trung.

---

## 2. Kiến Trúc State & Data Flow (Mới)
Cơ chế fetch dữ liệu vẫn dùng vanilla React state (`useState`/`useEffect` + `frontend/src/lib/api.ts`).

### 2.1 AuthProvider & AuthContext (`auth-provider.tsx`)
Thay thế `SpaInfo` cũ bằng `AuthUser` và `TenantInfo` nhận được từ `/api/auth/me`.
```typescript
interface AuthUser {
  id: string
  username: string
  role: 'super_admin' | 'owner' | 'staff'
  tenantId: string | null
  active: boolean
  fullName?: string
}

interface TenantInfo {
  id: string
  name: string
  slug: string
  business_type: string
  open_time: string
  close_time: string
}

interface AuthState {
  user: AuthUser
  tenant: TenantInfo | null
  permissions: string[] // định dạng "resource:action" (e.g. "order:create")
  logout: () => Promise<void>
}
```
* **Token Storage:** Đổi từ key `spa_token` thành `session_token` trong `localStorage` để khớp với JWT backend.
* **Header:** `Authorization: Bearer <session_token>`.

### 2.2 Client-Side Permission Guard (`PermissionGuard.tsx`)
Tạo component wrapper để ẩn/hiện hoặc chặn tương tác các phần UI dựa trên permissions thu được:
```typescript
export function PermissionGuard({ 
  children, 
  fallback = null, 
  resource, 
  action 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  resource: string
  action: 'view' | 'create' | 'edit' | 'delete'
}) {
  const { user, permissions } = useAuth()
  if (user.role === 'super_admin' || user.role === 'owner') return <>{children}</>
  const required = `${resource}:${action}`
  if (permissions.includes(required)) return <>{children}</>
  return <>{fallback}</>
}
```

---

## 3. Thiết Kế Menu Navigation (`sidebar.tsx` / `mobile-bottom-nav.tsx`)
Thêm các menu và bảo vệ bằng Role/Permission:
* **Tổng quan** (`/dashboard`) - `chat:view` hoặc `order:view`
* **Đơn hàng** (`/dashboard/orders`) - New menu, requires `order:view`
* **Đặt lịch** (`/dashboard/bookings`) - Requires `booking:view`
* **Dịch vụ / SP** (`/dashboard/products`) - Đổi tên từ "Pricing" (giá), requires `product:view`
* **Khách hàng** (`/dashboard/customers`) - Requires `customer:view`
* **Chat Dashboard** (`/dashboard/chat`) - Đổi tên từ "Chat logs", requires `chat:view`
* **Nhân viên & Vai trò** (`/dashboard/staff`) - New menu, requires `staff:view` hoặc `owner`
* **Cài đặt** (`/dashboard/settings`) - Requires `owner` / `super_admin`

---

## 4. Giao Diện Chi Tiết Các View Mới & Refactored

### 4.1 Orders Panel (`orders-panel.tsx` - Mới)
* **Chức năng:** Hiển thị danh sách hóa đơn bán hàng. Cho phép lọc theo chi nhánh, trạng thái đơn (`pending`, `completed`, `cancelled`), trạng thái thanh toán.
* **Tạo đơn:** Nút tạo đơn nhanh, chọn Customer, select Products/Services, tự động tính tổng tiền.
* **Thanh toán:** Panel phụ nhập số tiền thanh toán, chọn phương thức (Tiền mặt, Chuyển khoản, Momo), auto-update trạng thái thanh toán của Order (Unpaid -> Partial -> Paid).
* **Inventory warning:** Cảnh báo đỏ nếu product được chọn có `stock_quantity` < số lượng bán.

### 4.2 Bookings Panel Update (`bookings-panel.tsx` - Refactor)
* **Check Availability:** Khi đặt lịch, gọi `/api/bookings/availability?branch_id=X&date=Y` hiển thị các khung giờ bận/rảnh trực quan.
* **Overlap Alert:** Client check trùng lịch (hiển thị popup cảnh báo) trước khi gửi POST booking.
* **Auto-Order link:** Khi click chuyển trạng thái booking sang `completed`, hiển thị popup thông báo: *"Hóa đơn ORD-12345 đã tự động được tạo cho lịch hẹn này. [Xem hóa đơn]"*.

### 4.3 Chat Dashboard (`chat-dashboard-panel.tsx` - Thay thế ChatLogsPanel)
Refactor giao diện chat thành một Inbox 3 cột chuẩn Enterprise:
* **Cột 1: Danh sách session**
  * Tabs: "Đang xử lý (Bot)", "Chờ phản hồi (Staff)", "Đang chat", "Đã hoàn thành".
  * Icon chỉ rõ nguồn: Zalo (Zalo icon) hoặc Web Widget (Web icon).
  * Hiển thị tin nhắn cuối cùng + unread badge.
* **Cột 2: Khung Chat**
  * Render tin nhắn thời gian thực (polling 5s).
  * Input box nhập tin nhắn phản hồi của Staff (gọi POST `/api/chat/sessions/[id]/reply`).
  * Action Bar: Nút **"Nhận hỗ trợ (Assign)"** để gán cho bản thân, nút **"Hoàn thành (Resolve)"** để đóng session chuyển về Bot.
* **Cột 3: Context Khách Hàng (Customer Profile)**
  * Hiển thị tên, SĐT Zalo/Web, tags (VIP, Thân thiết).
  * Lịch sử booking gần nhất.
  * Handoff alert: Hiển thị nếu khách vừa cung cấp SĐT trên Web chat: *"Khách hàng đã cung cấp số điện thoại. Zalo session liên kết: [Mở chat Zalo]"*.

### 4.4 Bot & Zalo Settings (`settings-panel.tsx` - Refactor)
Chia cấu hình settings thành 3 tab rõ rệt:
1. **Thông tin doanh nghiệp:** Cập nhật Tenant config (giờ mở/đóng cửa, hotline, địa chỉ).
2. **Cấu hình Bot:** Cập nhật Bot name, greeting message, AI system prompt, select AI model.
3. **Zalo Bot Integration:**
   - Hộp nhập Cookie Zalo, IMEI, User Agent (mã hóa đầu vào).
   - Nút **"Kết nối Zalo"** (POST connect), nút **"Ngắt kết nối"** (POST disconnect).
   - Indicator hiển thị Trạng thái (Connected - màu xanh kèm tên tài khoản Zalo, Disconnected - màu đỏ).
4. **Web Widget Theme:**
   - Color picker chọn màu chủ đạo (Primary Color).
   - Dropdown chọn vị trí hiển thị (Bottom-Right, Bottom-Left).
   - Lời chào Widget.

### 4.5 Staff & Roles Panel (`staff-panel.tsx` - Mới)
Quản lý nhân sự nội bộ (Chỉ Owner/Super Admin thấy):
* **Tab Nhân viên:** Danh sách nhân viên, add staff mới, gán Role (Quản lý/Nhân viên), gán chi nhánh hoạt động.
* **Tab Vai trò & Quyền:** List các Role per tenant.
  - Chọn một Role (e.g. Nhân viên) -> Hiển thị bảng checklist phân quyền (View/Create/Edit/Delete) cho từng resource (Booking, Order, Customer, Chat, Product).
  - Nút **"Lưu quyền hạn"** (gọi API bulk update permissions).

---

## 5. Kế Hoạch Test & Verify
* **Test Case 1 (Role restriction):** Login account role `staff` -> Kiểm tra xem menu "Nhân viên & Vai trò" và "Cài đặt Zalo" có bị ẩn đi hay không.
* **Test Case 2 (Auto Order Creation):** Complete Booking -> Verify màn hình Booking hiển thị link tới hóa đơn vừa tạo tự động.
* **Test Case 3 (Real-time Chat Takeover):** Khách gửi tin trên web/zalo -> Session list hiển thị -> Staff bấm "Assign" -> Trạng thái đổi thành `staff_handling` -> Gửi tin nhắn trả lời -> Verify Web/Zalo nhận được tin nhắn đó.
