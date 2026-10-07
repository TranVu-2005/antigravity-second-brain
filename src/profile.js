// ==============================================================================
// Antigravity Second Brain: Tier 0 - Core Identity & User Profile Manager
// Manages "Biết tôi là ai": Who Ngài is, preferences, tone, habits, environment
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
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
        if (!key || typeof key !== 'string' || !key.trim()) return;
        if (!value || typeof value !== 'string' || !value.trim()) return;
        key = key.trim();
        value = value.trim();
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
        if (!key) return;
        this.db.run('DELETE FROM user_profile WHERE key = ?', key);
        this.syncFiles();
    }

    getProfileSummary() {
        const facts = this.getAll();
        const lines = ['[HỒ SƠ CỐT LÕI CỦA NGÀI]'];

        // Runtime environment awareness (Dual-Boot & Multi-Platform Parity)
        const currentOS = process.platform === 'win32' ? 'Windows 11' : `Linux (${os.type()} ${os.release()})`;
        const currentHost = os.hostname();
        const currentUser = os.userInfo().username;
        lines.push(`• current_runtime: ${currentOS} (Host: ${currentHost}, User: ${currentUser})`);

        for (const f of facts) {
            if (!f.key || !f.key.trim() || !f.value || !f.value.trim()) continue;
            if (f.key === 'os') {
                lines.push(`• dual_boot_os: ${f.value}`);
            } else if (f.key === 'hostname') {
                lines.push(`• dual_boot_hostname: ${f.value}`);
            } else {
                lines.push(`• ${f.key}: ${f.value}`);
            }
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
            const newJson = JSON.stringify(facts, null, 2);
            if (fs.existsSync(PROFILE_JSON_PATH)) {
                try {
                    const oldJson = fs.readFileSync(PROFILE_JSON_PATH, 'utf8');
                    if (oldJson.trim() === newJson.trim()) {
                        return; // Facts unchanged, avoid rewriting files & churning timestamps
                    }
                } catch (e) {}
            }
            fs.writeFileSync(PROFILE_JSON_PATH, newJson, 'utf8');

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

    // -------------------------------------------------------------------------
    // Tier 1: Working / Session Memory (session_state)
    // -------------------------------------------------------------------------
    updateSessionState(conversationId, { activeGoal = null, currentTopic = null, workspacePaths = [], metadata = {} } = {}) {
        if (!conversationId) return;
        const now = new Date().toISOString();
        const wsStr = Array.isArray(workspacePaths) ? JSON.stringify(workspacePaths) : (workspacePaths || '[]');
        const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');

        const existing = this.db.get('SELECT conversation_id, active_goal, current_topic FROM session_state WHERE conversation_id = ?', conversationId);
        if (existing) {
            this.db.run(`
                UPDATE session_state 
                SET active_goal = COALESCE(?, active_goal),
                    current_topic = COALESCE(?, current_topic),
                    workspace_paths = COALESCE(?, workspace_paths),
                    metadata = ?,
                    last_interaction = ?
                WHERE conversation_id = ?
            `, activeGoal, currentTopic, wsStr, metaStr, now, conversationId);
        } else {
            this.db.run(`
                INSERT INTO session_state (conversation_id, active_goal, current_topic, workspace_paths, metadata, last_interaction)
                VALUES (?, ?, ?, ?, ?, ?)
            `, conversationId, activeGoal, currentTopic, wsStr, metaStr, now);
        }
    }

    getSessionState(conversationId) {
        if (!conversationId) return null;
        return this.db.get('SELECT * FROM session_state WHERE conversation_id = ?', conversationId);
    }

    getLatestSessionState() {
        return this.db.get('SELECT * FROM session_state ORDER BY last_interaction DESC LIMIT 1');
    }
}

let instance = null;

function getProfileManager(db = getDB()) {
    const targetDb = db || getDB();
    if (!instance || instance.db !== targetDb) {
        instance = new ProfileManager(targetDb);
    }
    return instance;
}

module.exports = {
    ProfileManager,
    getProfileManager,
    PROFILE_MD_PATH,
    PROFILE_JSON_PATH
};
