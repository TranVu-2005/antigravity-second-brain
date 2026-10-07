---
name: gemini-web-bridge
description: Chuyên gia rà soát, thống kê vi mô và tối ưu vận hành Antigravity <-> Gemini Web Dual-Quota Bridge. Sử dụng khi Ngài gọi /gemini-web-bridge, yêu cầu kiểm tra sức khỏe bridge, thống kê hiệu năng, dọn dẹp phiên (sessions), đo độ trễ (latency), phân tích tài nguyên (RAM/CPU) hoặc tối ưu hóa hạ tầng kết nối theo chuẩn YAGNI và Ponytail.
---

# Antigravity <-> Gemini Web Bridge: Performance & Telemetry Engine

Skill này cung cấp cơ chế kiểm toán, thu thập số liệu chuẩn xác thời gian thực và quản trị tối ưu cho hệ sinh thái **Dual-Quota Bridge** giữa Google Antigravity và Gemini Chat Web, tuân thủ triệt để triết lý **YAGNI** và **Ponytail Minimalist** (không thêm thư viện thừa, không web server dashboard rườm rà, tận dụng 100% tài nguyên sẵn có).

---

## 1. Nguồn Dữ Liệu Thực Tế (Single Source of Truth)

Hệ thống thống kê thu thập từ 4 nguồn thực tế của hệ thống:
1. **Daemon State (`127.0.0.1:8765/status`):** Uptime, số tab mở, active thread URL.
2. **Process Telemetry (OS & PowerShell):** PID thực tế, RAM Working Set (MB), CPU time của `node.exe` daemon và tiến trình Chromium client (`brave.exe` / `chrome.exe`).
3. **Log Analytics (`bridge_debug.log`):** Bóc tách lịch sử từng lượt chat, phân tích độ trễ chính xác (latency theo giây) cho từng model (`flash`, `thinking`, `pro`), tỷ lệ thành công (Success Rate %) và số lần giải cứu câu trả lời bị từ chối (Refusal Defusing).
4. **Session Map (`sessions.json`):** Bản đồ ánh xạ các phiên làm việc của Antigravity với luồng hội thoại trên Gemini Web.

---

## 2. Quy Trình Thu Thập Dữ Liệu & Báo Cáo

Khi Ngài gọi `/gemini-web-bridge` hoặc yêu cầu kiểm tra/thống kê hệ thống bridge:

1. **Thực thi lệnh thu thập tức thời qua terminal:**
   ```powershell
   node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js"
   ```
2. **Định dạng báo cáo đệ trình Ngài theo cấu trúc chuẩn:**
   - **Trạng thái Trực tiếp (Live Status):** 🟢 ONLINE / 🔴 OFFLINE, Cổng kết nối, Uptime, Tab URL đang mở.
   - **Tài nguyên Tiến trình (Hardware Footprint):** RAM & CPU của Daemon và Trình duyệt.
   - **Thông lượng & Tốc độ (Throughput & Latency):** Tổng lượt prompt, Tỷ lệ thành công %, Độ trễ trung bình của Flash 3.8 (mục tiêu: 3-5s) vs Thinking (15-20s).
   - **Bản đồ Phiên (Session Health):** Tổng số phiên lưu trữ, số phiên cũ > 7 ngày cần dọn dẹp.
   - **Nhật ký Gần nhất (Recent Operations):** 5 yêu cầu gần nhất kèm thời gian và độ trễ.
   - **Tối ưu Hóa Hành Động (Actionable Recommendations):** Đưa ra giải pháp dọn rác, tinh chỉnh prompt hoặc reload tab nếu phát hiện độ trễ bất thường.

---

## 3. Hệ Sinh Thái MCP Tools Khả Dụng (Dual-Quota MCP Suite)

1. `ask_gemini_web(prompt, model, session_id, files, enrich_with_brain)`:
   - Truy vấn Gemini Web tốc độ cao (3-5s với Flash 3.8). Tự động cô lập phiên theo `session_id`.
   - **Tích hợp Second Brain:** Khi `enrich_with_brain: true`, tự động tiêm hồ sơ của Ngài, môi trường OS/phần cứng và sở thích kỹ thuật từ Second Brain SQLite vào context.
2. `gemini_web_generate_image(prompt, aspect_ratio, session_id)`:
   - **Mũi nhọn A:** Tạo ảnh chất lượng cao qua Imagen 3 trên Gemini Web. Tự động tải ảnh sinh ra về đĩa cục bộ (`scratch/gemini_artifacts`) và xuất link Markdown `![alt](file:///)` trực tiếp.
3. `gemini_web_deep_research(topic, requirements, focus, export_report, session_id, timeout)`:
   - **Mũi nhọn B:** Kích hoạt chế độ Nghiên cứu Sâu Tự Hành (Deep Autonomous Research) đa nguồn với Chain-of-Thought (Thinking Process). Tự động xuất báo cáo học thuật & kiến trúc độc lập ra file Markdown trong `scratch/deep_research/` kèm citations.
4. `gemini_web_distill_to_brain(title, content, category, tags)`:
   - **Mũi nhọn C:** Khớp nối 2 chiều: Chắt lọc thông tin giá trị, bài học hoặc giải pháp kỹ thuật từ Gemini Web và ghi nhận trực tiếp vào Antigravity Second Brain (SQLite FTS5 + Hybrid Search).
5. `gemini_web_consult_codebase(query, file_paths, focus, model, session_id)`:
   - Đưa trực tiếp nhiều tệp mã nguồn hoặc tài liệu dự án vào Context Window 2M tokens khổng lồ của Gemini Web để phân tích kiến trúc, phát hiện lỗi sâu hoặc đề xuất giải pháp tối ưu.
6. `gemini_web_review_code(code_or_diff, focus, context)`:
   - Pre-flight Peer Review cho code hoặc git diff với mô hình tư duy sâu (Thinking Model).
7. `gemini_web_status()`:
   - Kiểm tra nhanh trạng thái kết nối, URL luồng hội thoại và uptime.

---

## 4. Các Nâng Cấp Sản Xuất Cốt Lõi (Production-Grade Resilience)

- **Imagen 3 Local Asset Pipeline (Mũi nhọn A):** Tự động bắt ảnh DOM, chuyển đổi buffer/base64 ngay tại extension, ghi tệp an toàn vào đĩa và trả về đường dẫn `file:///` cho chat UI.
- **Deep Research Engine (Mũi nhọn B):** Tự động xây dựng meta-prompt chuẩn mực viện nghiên cứu, điều hướng mô hình Thinking, trích xuất citations và xuất bản tệp báo cáo markdown độc lập.
- **Second Brain Synapse 2 Chiều (Mũi nhọn C):** Tiêm ngữ cảnh hồ sơ của Ngài chiều vào và lưu trữ tri thức chiều ra trực tiếp vào SQLite FTS5 không qua bước trung gian rườm rà.
- **Tự Phục Hồi Tiến Trình (Auto-Healing Browser Launcher):** Nếu tab trình duyệt bị đóng hoặc crash, Daemon tự động kích hoạt lại browser sidecar trong nền và kết nối lại trong vòng 6s mà không làm gián đoạn lệnh gọi.
- **Bắt Lỗi & Quota Tức Thì (Instant Error & Rate-Limit Trapping):** Bắt ngay lập tức thông báo lỗi ("Đã xảy ra lỗi", "Rate limit reached") và tự động bấm nút "Thử lại" một lần. Nếu lỗi vĩnh viễn, lập tức thoát lỗi trong < 500ms thay vì treo 180s.
- **Khai Thác Google Search Grounding:** Tự động thu thập toàn bộ đường link nguồn thực tế và trích dẫn Google Search đính kèm vào cuối câu trả lời (`### 📚 Nguồn Dữ Liệu & Kiểm Chứng`).

---

## 5. Bộ Công Cụ Quản Trị & Nâng Cấp Nhanh (Zero-Bloat CLI Toolset)

```powershell
# 1. Nâng cấp phiên bản tự động 1 chạm (Single-Source-of-Truth Version Bumper)
# Tự động đồng bộ package.json, manifest.json, popup.html, reload extension và restart daemon:
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js" bump minor     # Nâng bản tính năng (ví dụ: 4.5.0 -> 4.6.0)
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js" bump patch     # Nâng bản vá lỗi (ví dụ: 4.5.0 -> 4.5.1)
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js" bump 5.0.0     # Đặt trực tiếp phiên bản cụ thể

# 2. Báo cáo thống kê hiệu năng, tài nguyên RAM/CPU và sức khỏe cầu nối thời gian thực:
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js"

# 3. Dọn dẹp toàn bộ các phiên hội thoại cũ hơn 7 ngày để tối ưu sessions.json:
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js" clean-sessions

# 4. Đo độ trễ ping round-trip trực tiếp tới Daemon:
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js" ping

# 5. Xoay vòng tệp nhật ký khi cần làm sạch dung lượng:
node "C:\Users\tvu16\.gemini\antigravity\gemini_web_bridge\telemetry.js" rotate-logs
```
