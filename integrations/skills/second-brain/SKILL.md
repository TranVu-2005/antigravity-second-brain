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
