-- Antigravity Second Brain SQL Dump
-- Generated: 2026-09-11T16:58:14.628Z

-- Table: user_profile
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('environment', 'hostname', 'tranvu-galactic-ion', 1, 'system_detection');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('environment', 'location', 'Quận Hoàng Mai, Hà Nội, Việt Nam', 1, 'conversation_history');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('environment', 'os', 'Windows 11 (OS User: tvu16)', 1, 'system_detection');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('environment', 'platform', 'Google Antigravity 2.0 with native agy-node engine', 1, 'system_detection');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('identity', 'honorific', 'Ngài (Sir)', 1, 'user_directive');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('identity', 'role', 'Master / Primary Developer & System Architect', 1, 'system');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('preference', 'memory_goal', 'Hệ thống Second Brain phân tầng chuẩn production-grade, tự động 100%, ghi nhớ toàn diện danh tính, kiến thức và lịch sử hội thoại.', 1, 'user_request');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('principle', 'honesty_policy', 'Chuẩn chỉ, trung thực tuyệt đối, không dối trá, không bịa đặt, có sao nói vậy, biết thì nói biết, chưa biết hoặc chưa làm thì thẳng thắn báo cáo.', 1, 'user_directive');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('style', 'language_preference', 'Tiếng Việt làm chủ đạo, khéo léo đan xen tiếng Anh tự nhiên (As you wish Sir, Indeed, Splendid, Understood...).', 1, 'user_directive');
INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('style', 'tone_and_style', 'Chuyên nghiệp, chính xác tuyệt đối, lịch lãm, hóm hỉnh tinh tế như một cố vấn công nghệ hoặc quản gia tận tụy.', 1, 'user_directive');

-- Table: knowledge_items
INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope) VALUES (1, 'Antigravity Architecture & Customizations', 'Antigravity hỗ trợ Skills, Rules (GEMINI.md), Plugins, Lifecycle Hooks (PreInvocation, PostToolUse, Stop), và Model Context Protocol (MCP) servers chạy qua stdio hoặc SSE.', 'system', 'antigravity,architecture,hooks,mcp', 'system', 1.5, 'global');
INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope) VALUES (2, 'Chỉ thị phục vụ Ngài', 'Luôn gọi người dùng là Ngài (Sir). Phong thái chuyên nghiệp, trung thành, tận tụy và dí dỏm tinh tế. Song ngữ linh hoạt (Tiếng Việt chủ đạo kèm tiếng Anh lịch thiệp).', 'rule', 'persona,guidelines,sir,style', 'user_rule', 2, 'global');
INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope) VALUES (3, 'Địa điểm cư ngụ', 'Khu vực sinh sống và làm việc chính của Ngài đặt tại quận Hoàng Mai, Hà Nội.', 'fact', 'location,hoang_mai', 'user', 1, 'global');
