---
name: second-brain
description: Hệ thống Second Brain ghi nhớ dài hạn chuẩn production-grade. Sử dụng khi cần lưu trữ, tìm kiếm kiến thức, truy cứu lịch sử hội thoại, cập nhật hồ sơ của Ngài hoặc đồng bộ dữ liệu đa tầng.
---

# Antigravity Second Brain: Cẩm Nang Vận Hành Bộ Nhớ Nhận Thức

Hệ thống Second Brain của Ngài là kiến trúc bộ nhớ phân tầng tự động 100% tích hợp trực tiếp vào Antigravity, được tối ưu hóa để ghi nhớ danh tính, kiến thức kỹ thuật và toàn bộ lịch sử tương tác.

## 1. Kiến Trúc Bộ Nhớ Phân Tầng

- **Tier 0: Core Identity & Profile (`user_profile`):**
  - Lưu trữ danh tính của Ngài, quy chuẩn xưng hô ("Ngài" / Sir), phong cách phục vụ, vị trí (Hoàng Mai, Hà Nội), hạ tầng máy.
  - Tự động nạp vào ngữ cảnh trước mỗi phản hồi qua `PreInvocation Hook`.
- **Tier 1: Working / Session Memory (`session_state`):**
  - Quản lý mục tiêu hiện tại, ngữ cảnh làm việc của phiên.
- **Tier 2: Episodic Memory (`episodes` & `episodes_fts`):**
  - Tự động nạp và chỉ mục hóa toàn bộ `transcript.jsonl` từ mọi cuộc hội thoại.
  - Tìm kiếm FTS5 BM25 xuyên suốt tất cả các phiên làm việc trong quá khứ.
- **Tier 3: Semantic Knowledge Store (`knowledge_items` & `knowledge_fts`):**
  - Tri thức dài hạn, snippets, quy tắc, giải pháp kỹ thuật, quyết định kiến trúc.
  - Thuật toán Hybrid Scoring: $Score = BM25 \times 0.6 + Importance \times 0.25 + Recency \times 0.15$.
- **Tier 4: Reflection Engine (`extractor.js` & `stop.js`):**
  - Chạy ngầm sau mỗi lượt chat để tự động phát hiện sở thích, chỉ thị, hoặc sự kiện mới để ghi nhớ mà Ngài không cần gõ lệnh thủ công.

---

## 2. Các Công Cụ MCP Khả Dụng (MCP Tools)

Khi MCP server `second-brain` hoạt động, Agent có thể sử dụng các công cụ:
- `brain_search(query, scope, limit)`: Tìm kiếm đa tầng (kiến thức + lịch sử chat).
- `brain_store(title, content, category, tags, importance)`: Lưu nhanh một phát kiến hoặc ghi chú.
- `brain_profile_get()` / `brain_profile_set(key, value)`: Đọc / cập nhật hồ sơ của Ngài.
- `brain_conversation_history(query, limit)`: Tra cứu lịch sử các phiên trước.
- `brain_stats()`: Báo cáo trạng thái bộ nhớ.
- `brain_git_backup(message)`: Tạo commit sao lưu Git tức thời kèm trích xuất text diff.
- `brain_git_status()`: Kiểm tra trạng thái đồng bộ kho lưu trữ Git và Remote.

---

## 3. Quản Trị Hệ Thống Qua CLI

Ngài hoặc trợ lý có thể chạy trực tiếp từ terminal:
```bash
# Đồng bộ toàn bộ các phiên hội thoại trong Antigravity brain
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" sync

# Sao lưu dữ liệu và commit lên Git
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" git-backup

# Kiểm tra trạng thái Git repository & Remote
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" git-status

# Thiết lập Remote repository (GitHub / GitLab)
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" git-remote https://github.com/<user>/<repo>.git

# Đẩy commit lên Remote repository
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" git-push

# Xem báo cáo thống kê
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" stats

# Tìm kiếm tri thức & lịch sử
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" search "từ khóa"

# Xem hồ sơ của Ngài
agy-node "C:/Users/tvu16/.gemini/antigravity/second_brain/cli.js" profile
```

---

## 4. Phím Tắt Tối Ưu Hệ Thống (Ponytail Shortcuts)

- **Kiểm tra nhiệt độ CPU & GPU (`temp`):** Thực thi ngay lệnh `temp` qua terminal để xuất báo cáo cảm biến thời gian thực (< 1.5s).
- **Kiểm tra tiến độ tải file & Game (`fdm [tên_game]`):** Thực thi ngay lệnh `fdm` (hoặc `fdm <tên>` như `fdm horizon`, `fdm diablo`, `fdm riot`, `fdm lol`) qua terminal để xuất báo cáo %, dung lượng, các part và trạng thái hoàn tất tức thì (< 50ms) cho cả Free Download Manager và Hệ sinh thái Riot Games. Tuyệt đối không viết script tạm thời hay quét đĩa toàn cục.
- **Tắt màn hình Eco Agentic Mode (`screenoff`):** Thực thi `screenoff` qua terminal để hạ điện năng CPU về 2W và tắt màn hình tức thì.

---

## 5. Phiên Bản Hiện Tại: [3.6.0] (Universal Dual-Boot Parity, Full Superpowers Suite & 1-Click Linux Deploy Engine)
- **Đóng gói toàn diện bộ kỹ năng Superpowers:** Tự động triển khai 24 kỹ năng nhận thức chuẩn công nghiệp (/superpowers, /ponytail, /tdd-master, /verification-before-completion...) trên cả Windows và Linux.
- **Tối ưu song song Linux hoàn hảo:** Tự động phân quyền 755, cài đặt phím tắt Linux (`temp`, `screenoff`, `agy-brain`) vào `~/.local/bin/`.
- **Đồng bộ quy tắc Persona & Rules:** Bảo toàn phong cách phục vụ ("Ngài" / Sir) và routing Quota kép qua `GEMINI.md`.
- **Triệt tiêu 100% lỗi SQLite Binding Crash:** Tự động chuyển đổi `undefined` sang `null` tại tầng driver cốt lõi `src/db.js`.
- **Tăng tốc nạp lịch sử (Batch Transaction Ingestion):** Nạp 50 steps trong < 15ms qua transaction chuẩn thay vì 50 transactions đơn lẻ.
- **Tách rời PreInvocation & Background Distillation:** Đảm bảo độ trễ hook trước mỗi lượt chat luôn < 15ms.
- **Pháo đài kiểm thử TDD Fortress:** Môi trường test hoàn toàn cô lập trong bộ nhớ RAM (`:memory:`), không làm bẩn CSDL `brain.db`.
- **Đồng bộ nhận diện phím tắt & Fast-Path SLA:** Tự động bắt đúng phím tắt game (`forza6`, `fh6`, `d2r`, `screenoff`, `temp`) với tốc độ < 50ms.

