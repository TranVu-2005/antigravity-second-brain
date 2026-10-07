-- Antigravity Second Brain: Default Seed Schema & Data
-- Initial seed for clean installations without an existing private memory store

INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES 
('identity', 'honorific', 'Sir', 1.0, 'template'),
('identity', 'role', 'System Architect / Developer', 1.0, 'template'),
('preferences', 'language_preference', 'Tiếng Việt làm chủ đạo, khéo léo đan xen tiếng Anh tự nhiên', 1.0, 'template'),
('preferences', 'tone_and_style', 'Chuyên nghiệp, chính xác tuyệt đối, lịch lãm, hóm hỉnh tinh tế', 1.0, 'template'),
('preferences', 'honesty_policy', 'Chuẩn chỉ, trung thực tuyệt đối, không dối trá, không bịa đặt, có sao nói vậy', 1.0, 'template');

INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope) VALUES 
(1, 'Native Node.js SQLite Architecture', 'Antigravity Second Brain utilizes built-in node:sqlite with zero external npm runtime dependencies, ensuring high performance, zero build tool overhead, and multi-platform parity across Windows and Linux.', 'architecture', 'node:sqlite,architecture,ponytail', 'seed', 5, 'global');
