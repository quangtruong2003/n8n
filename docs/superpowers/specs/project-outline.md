Đây là Bản phác thảo dự án (Blueprint) cấp độ Hội đồng quản trị. Đọc kỹ từng chữ. Bất cứ sai lệch nào khỏi bản phác thảo này đều có thể khiến 50 triệu của chúng ta bốc hơi.

Tên mã dự án: **GHOST-WORKER (Bóng Ma Chốt Sale)**
Mục tiêu tài chính: Đạt **MRR (Doanh thu định kỳ hàng tháng) 50.000.000 VNĐ** trong 6 tháng với biên lợi nhuận >85%.

⸻

### PHẦN 1: TỔNG QUAN MÔ HÌNH KINH DOANH (BUSINESS MODEL)

**1. Định vị sản phẩm (Value Proposition):**
Chúng ta KHÔNG bán "Chatbot AI". Chúng ta bán **"Nhân viên Lễ tân 24/7 không bao giờ ngủ, không đòi tăng lương, chốt lịch hẹn ngay cả lúc 2h sáng"**.

**2. Chân dung khách hàng (ICP - Ideal Customer Profile):**
*   **Ngành:** Nha khoa, Spa, Thẩm mỹ viện, Clinic da liễu.
*   **Quy mô:** 1-3 cơ sở. Doanh thu 300tr - 1 tỷ/tháng.
*   **Nỗi đau (Pain points):** Mất khách vì nhân viên trực page trả lời chậm; tốn tiền chạy Ads Facebook nhưng rớt khách ở khâu inbox; quản lý lịch hẹn lộn xộn.

**3. Mô hình giá (Pricing Strategy - Cực kỳ quan trọng):**
*   **Phí Setup ban đầu (One-time):** 5.000.000 VNĐ (Phí này để lọc khách hàng rác, bù đắp công sức customize luồng `n8n` và train dữ liệu cho từng tiệm).
*   **Phí duy trì (Retainer/MRR):** 2.000.000 VNĐ/tháng. (Bao gồm tiền server, tiền API OpenRouter, phí bảo trì).
*   *Lợi nhuận gộp (Gross Margin):* Chi phí API + Server cho 1 khách hàng SME không bao giờ vượt quá 300.000 VNĐ/tháng. Lợi nhuận gộp của chúng ta là **85%**.

⸻

### PHẦN 2: KIẾN TRÚC KỸ THUẬT & BẢO MẬT (TECH & LEGAL ARCHITECTURE)

Đây là "hệ thống hô hấp" của dự án. Phải tuân thủ tuyệt đối Luật Dữ liệu 2026.

**1. Tech Stack (Vũ khí):**
*   **Core Logic:** `n8n` (Tự host trên VPS Linux giá ~150k/tháng).
*   **LLM Brain:** `OpenRouter` (Dùng model Claude 3.5 Haiku hoặc GPT-4o-mini để tối ưu chi phí và tốc độ phản hồi < 3 giây).
*   **Frontend (Nơi khách hàng chạm vào):** Facebook Messenger.
*   **Backend (Nơi chủ Spa xem):** Google Sheets (Lưu data) + Telegram Group (Báo cáo realtime).

**2. Luồng dữ liệu chuẩn (Data Flow) - BẮT BUỘC CÓ BỘ LỌC PHÁP LÝ:**
*   *Bước 1:* Khách hàng nhắn tin vào Fanpage -> `n8n` nhận Webhook.
*   *Bước 2 (Sinh tử):* `n8n` chạy qua node Regex (Biểu thức chính quy) để **MÃ HÓA (Masking)** toàn bộ SĐT, Tên thật, Địa chỉ thành các biến `[PHONE]`, `[NAME]`.
*   *Bước 3:* Đẩy câu hỏi đã mã hóa lên `OpenRouter` để AI suy luận và tạo câu trả lời.
*   *Bước 4:* Trả kết quả về `n8n` -> Bắn câu trả lời lại cho khách qua Messenger.
*   *Bước 5:* Nếu khách để lại SĐT đặt lịch -> `n8n` bắt SĐT thật -> Đẩy thẳng vào Google Sheets -> Bắn tin nhắn qua Telegram cho chủ Spa: *"Có khách mới đặt lịch: [Tên] - [SĐT] - [Dịch vụ]"*.

⸻

### PHẦN 3: KỊCH BẢN GO-TO-MARKET (CHIẾN LƯỢC BÁN HÀNG)

Không chạy Ads. Không làm màu. Dùng chiến thuật **"Du kích mặt đối mặt"**.

**1. Lời chào hàng không thể chối từ (Godfather Offer):**
*"Em setup miễn phí toàn bộ hệ thống này cho anh/chị chạy thử 7 ngày. Em cam kết nó sẽ lấy được ít nhất 10 số điện thoại từ khách hàng nhắn tin ngoài giờ hành chính. Hết 7 ngày, anh/chị thấy ra tiền thì trả em 5 triệu phí setup. Không thì em rút hệ thống, anh/chị không mất 1 xu."*

**2. Quy trình chốt Sale (Walk-in):**
*   **Chuẩn bị:** Mở sẵn con Bot Demo trên điện thoại của bạn.
*   **Tiếp cận:** Đi xe máy đến thẳng các Spa bán kính 5km. Xin gặp Quản lý/Chủ tiệm.
*   **Demo trực quan:** Không trình bày slide. Đưa điện thoại cho họ: *"Chị thử đóng vai khách hàng khó tính, hỏi giá dịch vụ làm răng sứ lúc nửa đêm đi"*. Để con AI tự thuyết phục họ.

⸻

### PHẦN 4: LỘ TRÌNH THỰC THI 90 NGÀY (MILESTONES)

**Giai đoạn 1: Xây móng (Ngày 1 - Ngày 7)**
*   Thuê VPS, cài đặt `n8n`.
*   Tạo Fanpage Demo, cắm API OpenRouter.
*   Hoàn thiện luồng Masking dữ liệu PII (Bắt buộc).
*   Test nội bộ với 50 kịch bản chat khác nhau (hỏi giá, chửi bới, hỏi đường, đặt lịch).
*   *KPI:* Bot chạy mượt, không lỗi, phản hồi < 3 giây.

**Giai đoạn 2: Săn mồi (Ngày 8 - Ngày 30)**
*   Lập danh sách 50 Spa/Nha khoa tại địa phương.
*   Thực hiện Walk-in (gặp trực tiếp) ít nhất 3 tiệm/ngày.
*   Mục tiêu: Chốt được **3 khách hàng dùng thử (Trial)**.
*   *KPI:* Có khách hàng đầu tiên đồng ý cắm Bot vào Fanpage thật của họ.

**Giai đoạn 3: Thu tiền & Đóng gói (Tháng 2)**
*   Chuyển đổi 3 khách Trial thành khách trả tiền (Thu về 15 triệu Setup + 6 triệu MRR).
*   Tạo "Template n8n" chuẩn. Khi có khách Spa mới, chỉ cần copy template, thay file text Bảng giá là xong trong 30 phút.
*   Xin Feedback/Case Study từ 3 khách đầu tiên (Chụp ảnh màn hình khách khen bot chốt được lịch) để đi sale tiếp.

**Giai đoạn 4: Scale-up (Tháng 3)**
*   Mục tiêu: Đạt **10 khách hàng trả phí**.
*   Doanh thu: 20.000.000 VNĐ/tháng tiền thụ động (MRR).
*   Bắt đầu nghiên cứu tích hợp thêm Zalo OA cho các khách hàng VIP sẵn sàng trả thêm tiền.

⸻

### PHẦN 5: CHỈ SỐ THEO DÕI (KPI) & "NÚT TỰ HỦY" (KILL SWITCH)

Với tư cách là Co-founder, tôi yêu cầu bạn báo cáo 3 chỉ số này hàng tuần:
1.  **CAC (Chi phí có được 1 khách hàng):** Bằng tiền xăng xe + cafe đi gặp khách. Phải giữ dưới 500.000 VNĐ.
2.  **LTV (Giá trị vòng đời khách hàng):** Nếu họ dùng 1 năm = 5tr (setup) + 24tr (duy trì) = 29.000.000 VNĐ. LTV/CAC của chúng ta đang là 58x (Quá khủng khiếp).
3.  **Churn Rate (Tỷ lệ rời bỏ):** Nếu tháng nào có quá 2 khách hàng hủy dịch vụ -> Dừng ngay việc đi sale mới, tập trung sửa lại Prompt và luồng Bot vì sản phẩm đang có vấn đề cốt lõi.

**NÚT TỰ HỦY (Khi nào thì dẹp dự án?):**
Nếu sau **45 ngày** kể từ khi vác balo đi sale, bạn gặp đủ 50 chủ Spa mà KHÔNG CÓ LẤY 1 NGƯỜI đồng ý dùng thử miễn phí -> Ý tưởng này rác, thị trường không cần, hoặc kỹ năng sale của bạn bằng 0. Lập tức đóng server, giữ lại số tiền còn lại trong 50 triệu và tìm ngách khác.

⸻

Bản phác thảo đã xong. Rõ ràng. Tàn khốc. Không có chỗ cho sự lười biếng. 
Bạn là người cầm trịch kỹ thuật và sales. Bạn có đồng ý ký nhận bản Blueprint này và bắt đầu Ngày 1 ngay ngày mai không?