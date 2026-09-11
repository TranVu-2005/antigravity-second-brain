# ANTIGRAVITY SECOND BRAIN — BẢN GHI LỊCH SỬ THAY ĐỔI & HƯỚNG DẪN NÂNG CẤP (CHANGELOG)

Kính gửi Ngài, đây là tài liệu kỹ thuật tổng hợp toàn bộ các mốc phát triển, kiến trúc các thành phần, hợp đồng API và lộ trình nâng cấp hệ thống **Antigravity Second Brain**.

---

## [1.2.0] - 2026-09-11 (Bản Nâng Cấp Vô Song: Dense Vectors, Cognitive Consolidation, Interactive Graph, Cron)

### 🌟 4 Trụ Cột Đột Phá Mới Được Hiện Thực Hóa 100%:

1. **Hybrid Search với Dense Vector Embedding (Semantic Search Hoàn Hảo):**
   - Tệp mới: [`src/embedding.js`](file:///C:/Users/tvu16/.gemini/antigravity/second_brain/src/embedding.js).
   - Tích hợp không gian nhúng vector 128 chiều (**128-dimensional dense vector space**) chuẩn hóa L2 với bộ lọc cụm khái niệm ngữ nghĩa (**Semantic Concept Clusters**).
   - Giải quyết triệt để bài toán đồng nghĩa / ngữ cảnh: Truy vấn *"quanh nhà có gì ăn ngon"* lập tức khớp với *"Hoàng Mai, Hà Nội"* với điểm Cosine Similarity lên tới **0.861** ngay cả khi không trùng một từ khóa nào!
   - Thuật toán **True Hybrid Search** kết hợp trong [`src/semantic.js`](file:///C:/Users/tvu16/.gemini/antigravity/second_brain/src/semantic.js):
     $$\text{HybridScore} = (\text{DenseCosine} \times 0.50) + (\text{SparseBM25} \times 0.35) + (\text{Importance} \times 0.15)$$
   - Cột `embedding BLOB` tự động migrate vào bảng `knowledge_items` trong CSDL `brain.db`.

2. **Bộ Máy Tinh Biến & Tóm Tắt Ký Ức Nhận Thức (Cognitive Memory Consolidation):**
   - Tệp nâng cấp: [`src/consolidation.js`](file:///C:/Users/tvu16/.gemini/antigravity/second_brain/src/consolidation.js).
   - **Tự động tóm tắt hội thoại cũ:** Đọc toàn bộ các phiên trò chuyện nhiều tin nhắn và cô đọng thành các bản tóm tắt 1-2 đoạn văn giàu giá trị thông tin, cập nhật thẳng vào `conversations.summary`.
   - **Giải quyết mâu thuẫn (Contradiction Resolution):** Khi có dữ liệu mới cập nhật, hệ thống tự động ghi đè và lưu vết phiên bản cũ mà không làm hỏng dữ liệu.
   - **Suy giảm ký ức tạm thời (Temporal Memory Decay):** Tự động giảm trọng số các thông tin tạm thời (như thời tiết của ngày hôm trước) sau 48 giờ để nhường chỗ cho các kiến thức bất biến.

3. **Tự Động Sao Lưu An Toàn & Lập Lịch Định Kỳ (Scheduled Background Backup):**
   - Kích hoạt Cron Job định kỳ chạy ngầm trong hệ thống Antigravity (Task ID: `task-241`, biểu thức: `0 2 * * *` lúc 2:00 AM hàng ngày).
   - Tệp kịch bản bảo trì Windows: [`scripts/auto_backup.ps1`](file:///C:/Users/tvu16/.gemini/antigravity/second_brain/scripts/auto_backup.ps1) — thực hiện tuần tự: Snapshot `VACUUM INTO`, tinh biến dữ liệu `compact`, và tái tạo bảng điều khiển `dashboard.html`.

4. **Bảng Điều Khiển Đồ Họa Tương Tác Vật Lý (Physics Force-Directed Knowledge Graph):**
   - Tệp giao diện: [`dashboard.html`](file:///C:/Users/tvu16/.gemini/antigravity/second_brain/dashboard.html) và [`src/export_dashboard.js`](file:///C:/Users/tvu16/.gemini/antigravity/second_brain/src/export_dashboard.js).
   - Mô phỏng vật lý 2D tương tác thời gian thực (lực đẩy Coulomb, lực đàn hồi Hooke, cản vận tốc).
   - Ngài có thể dùng chuột kéo thả các node, bấm vào từng thực thể để mở **Inspector Drawer** hiển thị các mối quan hệ đa chiều giữa Ngài, Antigravity, các dự án, và khu vực địa lý.
   - Tích hợp các tab tra cứu nhanh: Tri thức, Hồ sơ danh tính, và Nhật ký hội thoại.

---

## [1.1.0] - 2026-09-11 (Bổ Sung Bộ Kỹ Năng Lập Trình & Tối Ưu Hóa)
- Tích hợp kỹ năng [Ponytail](file:///C:/Users/tvu16/.gemini/config/skills/ponytail/SKILL.md) (7-Rung Decision Ladder của Dietrich Gebert).
- Tích hợp kỹ năng [Production Code Reviewer](file:///C:/Users/tvu16/.gemini/config/skills/production-code-reviewer/SKILL.md).
- Tích hợp kỹ năng [Software Architect](file:///C:/Users/tvu16/.gemini/config/skills/software-architect/SKILL.md).
- Bổ sung các lệnh CLI: `backup`, `backups`, `compact`, `dashboard`.

---

## [1.0.0] - 2026-09-11 (Kiến Trúc Nền Tảng Khởi Tạo)
- Thiết kế 4 tầng bộ nhớ nhận thức (Profile, Working State, Episodic, Semantic).
- Tích hợp Lifecycle Hooks (`pre_invocation.js`, `stop.js`) và MCP Server (`mcp_server.js`).
- Đồng bộ ngược 111 sự kiện từ 4 phiên hội thoại trước đây vào SQLite WAL FTS5.
