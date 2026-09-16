// ==============================================================================
// Antigravity Second Brain: Tier 0 - Core Identity & User Profile Manager
// Manages "Biết tôi là ai": Who Ngài is, preferences, tone, habits, environment
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getDB, BRAIN_DIR } = require('./db');

const PROFILE_MD_PATH = path.join(BRAIN_DIR, 'profile.md');
const PROFILE_JSON_PATH = path.join(BRAIN_DIR, 'profile.json');

const INITIAL_PROFILE = [
    { key: 'honorific', category: 'identity', value: 'Ngài (Sir)', confidence: 1.0, source: 'user_directive' },
    { key: 'role', category: 'identity', value: 'Master / Primary Developer & System Architect', confidence: 1.0, source: 'system' },
    { key: 'tone_and_style', category: 'style', value: 'Chuyên nghiệp, chính xác tuyệt đối, lịch lãm, hóm hỉnh tinh tế như một cố vấn công nghệ hoặc quản gia tận tụy.', confidence: 1.0, source: 'user_directive' },
    { key: 'language_preference', category: 'style', value: 'Tiếng Việt làm chủ đạo, khéo léo đan xen tiếng Anh tự nhiên (As you wish Sir, Indeed, Splendid, Understood...).', confidence: 1.0, source: 'user_directive' },
    { key: 'location', category: 'environment', value: 'Quận Hoàng Mai, Hà Nội, Việt Nam', confidence: 1.0, source: 'conversation_history' },
    { key: 'os', category: 'environment', value: 'Windows 11 (OS User: tvu16)', confidence: 1.0, source: 'system_detection' },
    { key: 'hostname', category: 'environment', value: 'tranvu-galactic-ion', confidence: 1.0, source: 'system_detection' },
    { key: 'platform', category: 'environment', value: 'Google Antigravity 2.0 with native agy-node engine', confidence: 1.0, source: 'system_detection' },
    { key: 'memory_goal', category: 'preference', value: 'Hệ thống Second Brain phân tầng chuẩn production-grade, tự động 100%, ghi nhớ toàn diện danh tính, kiến thức và lịch sử hội thoại.', confidence: 1.0, source: 'user_request' }
];

class ProfileManager {
    constructor(db = getDB()) {
        this.db = db;
        this._bootstrap();
    }

    _bootstrap() {
        const count = this.db.get('SELECT COUNT(*) as cnt FROM user_profile').cnt;
        if (count === 0) {
            for (const item of INITIAL_PROFILE) {
                this.setFact(item.key, item.value, item.category, item.confidence, item.source);
            }
            this.syncFiles();
        }
    }

    getAll() {
        return this.db.all('SELECT * FROM user_profile ORDER BY category, key');
    }

    get(key) {
        const row = this.db.get('SELECT * FROM user_profile WHERE key = ?', key);
        return row ? row.value : null;
    }

    setFact(key, value, category = 'general', confidence = 1.0, source = 'system') {
        const existing = this.db.get('SELECT * FROM user_profile WHERE key = ?', key);
        const now = new Date().toISOString();
        if (existing) {
            this.db.run(`
                UPDATE user_profile 
                SET value = ?, category = ?, confidence = ?, source = ?, updated_at = ?
                WHERE key = ?
            `, value, category, confidence, source, now, key);
        } else {
            this.db.run(`
                INSERT INTO user_profile (key, category, value, confidence, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, key, category, value, confidence, source, now, now);
        }
        this.syncFiles();
    }

    deleteFact(key) {
        this.db.run('DELETE FROM user_profile WHERE key = ?', key);
        this.syncFiles();
    }

    getProfileSummary() {
        const facts = this.getAll();
        const lines = ['[HỒ SƠ CỐT LÕI CỦA NGÀI]'];
        for (const f of facts) {
            lines.push(`• ${f.key}: ${f.value}`);
        }
        return lines.join('\n');
    }

    syncFiles() {
        try {
            // Guard: Only write root profile files if connected to production brain.db
            const prodDbPath = path.resolve(path.join(BRAIN_DIR, 'brain.db'));
            if (this.db && this.db.dbPath && path.resolve(this.db.dbPath) !== prodDbPath) {
                return;
            }

            const facts = this.getAll();
            fs.writeFileSync(PROFILE_JSON_PATH, JSON.stringify(facts, null, 2), 'utf8');

            let md = `# Hồ Sơ Cá Nhân & Phong Cách Phục Vụ Của Ngài (Core Profile)\n\n`;
            md += `> Tự động đồng bộ với Antigravity Second Brain. Cập nhật lần cuối: ${new Date().toLocaleString()}\n\n`;
            
            const categories = {};
            for (const f of facts) {
                if (!categories[f.category]) categories[f.category] = [];
                categories[f.category].push(f);
            }

            for (const [cat, list] of Object.entries(categories)) {
                md += `### Phân mục: ${cat.toUpperCase()}\n`;
                for (const item of list) {
                    md += `- **${item.key}**: ${item.value} *(Độ tin cậy: ${Math.round(item.confidence * 100)}% | Nguồn: ${item.source})*\n`;
                }
                md += `\n`;
            }

            fs.writeFileSync(PROFILE_MD_PATH, md, 'utf8');
        } catch (err) {
            console.error('Error syncing profile files:', err.message);
        }
    }
}

let instance = null;

function getProfileManager(db = getDB()) {
    if (!instance) {
        instance = new ProfileManager(db);
    }
    return instance;
}

module.exports = {
    ProfileManager,
    getProfileManager,
    PROFILE_MD_PATH,
    PROFILE_JSON_PATH
};
