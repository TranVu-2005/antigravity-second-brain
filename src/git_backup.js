// ==============================================================================
// Antigravity Second Brain: Git Automated Backup & Version Control Subsystem
// Exports human-readable diffable snapshots & handles automated Git sync
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { getDB, BRAIN_DIR } = require('./db');

const EXPORTS_DIR = path.join(BRAIN_DIR, 'exports');

class GitBackupManager {
    constructor(brainDir = BRAIN_DIR, exportsDir = EXPORTS_DIR) {
        this.brainDir = brainDir;
        this.exportsDir = exportsDir;
        this.gitCmd = this._resolveGitCommand();

        if (!fs.existsSync(this.exportsDir)) {
            fs.mkdirSync(this.exportsDir, { recursive: true });
        }
    }

    _resolveGitCommand() {
        // Test standard git in PATH first
        try {
            execSync('git --version', { stdio: 'ignore' });
            return 'git';
        } catch (e) {}

        // Check common OS installation locations
        const candidatePaths = process.platform === 'win32' ? [
            'C:\\Program Files\\Git\\cmd\\git.exe',
            'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'git.exe')
        ] : [
            '/usr/bin/git',
            '/usr/local/bin/git',
            '/opt/homebrew/bin/git'
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                return process.platform === 'win32' ? `"${p}"` : p;
            }
        }

        return 'git';
    }

    _execGit(cmd) {
        return execSync(`${this.gitCmd} ${cmd}`, {
            cwd: this.brainDir,
            encoding: 'utf8',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
    }

    isGitAvailable() {
        try {
            const version = execSync(`${this.gitCmd} --version`, { encoding: 'utf8' }).trim();
            return { available: true, version };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    isRepoInitialized() {
        return fs.existsSync(path.join(this.brainDir, '.git'));
    }

    initRepo() {
        if (this.isRepoInitialized()) {
            return { initialized: true, alreadyExisted: true };
        }
        try {
            this._execGit('init -b main');
            return { initialized: true, alreadyExisted: false };
        } catch (e) {
            // Fallback for older git versions without -b flag
            this._execGit('init');
            try {
                this._execGit('branch -M main');
            } catch (err) {}
            return { initialized: true, alreadyExisted: false };
        }
    }

    exportDataSnapshot() {
        const db = getDB();

        // 0. Force checkpoint SQLite WAL into main brain.db file
        try {
            db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        } catch (e) {}

        // 1. Export Profile (Hồ sơ cá nhân)
        const profileRows = db.all('SELECT category, key, value, confidence, source, updated_at FROM user_profile ORDER BY category, key');
        const profilePath = path.join(this.exportsDir, 'profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(profileRows, null, 2), 'utf8');

        // 2. Export Knowledge Items (không kèm raw embedding BLOB để giữ text diff sạch)
        const knowledgeRows = db.all('SELECT id, title, content, category, tags, source, importance, project_scope, created_at, updated_at FROM knowledge_items ORDER BY id ASC');
        const knowledgePath = path.join(this.exportsDir, 'knowledge.json');
        fs.writeFileSync(knowledgePath, JSON.stringify(knowledgeRows, null, 2), 'utf8');

        // 3. Export Solutions (Procedural memory)
        const solutionRows = db.all('SELECT id, error_pattern, root_cause, solution_code, command_fix, project_scope, confidence, success_count, created_at FROM solutions ORDER BY id ASC');
        const solutionsPath = path.join(this.exportsDir, 'solutions.json');
        fs.writeFileSync(solutionsPath, JSON.stringify(solutionRows, null, 2), 'utf8');

        // 4. Export Conversations Summary
        const convRows = db.all('SELECT id, title, summary, message_count, updated_at FROM conversations ORDER BY updated_at DESC');
        const convPath = path.join(this.exportsDir, 'conversations_summary.json');
        fs.writeFileSync(convPath, JSON.stringify(convRows, null, 2), 'utf8');

        // 4.5. Export Episodes (Episodic memory - Lịch sử hội thoại đầy đủ)
        const episodeRows = db.all('SELECT id, conversation_id, step_index, role, summary, timestamp FROM episodes ORDER BY id ASC');
        const epPath = path.join(this.exportsDir, 'episodes_log.json');
        fs.writeFileSync(epPath, JSON.stringify(episodeRows, null, 2), 'utf8');

        // 5. Generate 100% Comprehensive Human-Readable SQL Dump
        let sqlDump = `-- Antigravity Second Brain SQL Dump\n-- Generated: ${new Date().toISOString()}\n\n`;
        
        // Profile inserts
        sqlDump += `-- Table: user_profile\n`;
        for (const row of profileRows) {
            const val = (row.value || '').replace(/'/g, "''");
            sqlDump += `INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('${row.category}', '${row.key}', '${val}', ${row.confidence}, '${row.source}');\n`;
        }
        sqlDump += `\n-- Table: knowledge_items\n`;
        for (const row of knowledgeRows) {
            const title = (row.title || '').replace(/'/g, "''");
            const content = (row.content || '').replace(/'/g, "''");
            const tags = (row.tags || '').replace(/'/g, "''");
            sqlDump += `INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope) VALUES (${row.id}, '${title}', '${content}', '${row.category}', '${tags}', '${row.source}', ${row.importance}, '${row.project_scope}');\n`;
        }
        sqlDump += `\n-- Table: solutions\n`;
        for (const row of solutionRows) {
            const errP = (row.error_pattern || '').replace(/'/g, "''");
            const solC = (row.solution_code || '').replace(/'/g, "''");
            const root = (row.root_cause || '').replace(/'/g, "''");
            const cmd = (row.command_fix || '').replace(/'/g, "''");
            sqlDump += `INSERT OR REPLACE INTO solutions (id, error_pattern, root_cause, solution_code, command_fix, project_scope, confidence, success_count) VALUES (${row.id}, '${errP}', '${root}', '${solC}', '${cmd}', '${row.project_scope}', ${row.confidence}, ${row.success_count});\n`;
        }
        sqlDump += `\n-- Table: conversations\n`;
        for (const row of convRows) {
            const title = (row.title || '').replace(/'/g, "''");
            const sum = (row.summary || '').replace(/'/g, "''");
            sqlDump += `INSERT OR REPLACE INTO conversations (id, title, summary, message_count) VALUES ('${row.id}', '${title}', '${sum}', ${row.message_count});\n`;
        }

        // Session state inserts (Tier 1 Working Memory)
        try {
            const sessionRows = db.all('SELECT conversation_id, active_goal, current_topic, workspace_paths, metadata, last_interaction FROM session_state');
            if (sessionRows && sessionRows.length > 0) {
                sqlDump += `\n-- Table: session_state\n`;
                for (const row of sessionRows) {
                    const cid = (row.conversation_id || '').replace(/'/g, "''");
                    const goal = (row.active_goal || '').replace(/'/g, "''");
                    const topic = (row.current_topic || '').replace(/'/g, "''");
                    const wp = (row.workspace_paths || '[]').replace(/'/g, "''");
                    const meta = (row.metadata || '{}').replace(/'/g, "''");
                    sqlDump += `INSERT OR REPLACE INTO session_state (conversation_id, active_goal, current_topic, workspace_paths, metadata, last_interaction) VALUES ('${cid}', '${goal}', '${topic}', '${wp}', '${meta}', '${row.last_interaction}');\n`;
                }
            }
        } catch (e) {}

        // Entity relations inserts (Knowledge Graph)
        try {
            const relationRows = db.all('SELECT source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata FROM entity_relations');
            if (relationRows && relationRows.length > 0) {
                sqlDump += `\n-- Table: entity_relations\n`;
                for (const row of relationRows) {
                    const src = (row.source_entity || '').replace(/'/g, "''");
                    const rel = (row.relation || '').replace(/'/g, "''");
                    const tgt = (row.target_entity || '').replace(/'/g, "''");
                    const meta = (row.metadata || '{}').replace(/'/g, "''");
                    const vUntil = row.valid_until ? `'${row.valid_until}'` : 'NULL';
                    sqlDump += `INSERT OR REPLACE INTO entity_relations (source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata) VALUES ('${src}', '${rel}', '${tgt}', ${row.confidence}, '${row.valid_from}', ${vUntil}, '${meta}');\n`;
                }
            }
        } catch (e) {}

        const sqlDumpPath = path.join(this.exportsDir, 'dump.sql');
        fs.writeFileSync(sqlDumpPath, sqlDump, 'utf8');

        // 5.5. Regenerate interactive visual dashboard with current live data
        try {
            const { generateDashboard } = require('./export_dashboard');
            generateDashboard();
        } catch (e) {}

        // 6. Bundle external Antigravity configurations for 100% portable setup
        this._bundleIntegrations();

        return {
            profileCount: profileRows.length,
            knowledgeCount: knowledgeRows.length,
            solutionsCount: solutionRows.length,
            conversationsCount: convRows.length,
            episodesCount: episodeRows.length,
            exportedFiles: ['profile.json', 'knowledge.json', 'solutions.json', 'conversations_summary.json', 'episodes_log.json', 'dump.sql']
        };
    }

    _bundleIntegrations() {
        const intDir = path.join(this.brainDir, 'integrations');
        if (!fs.existsSync(intDir)) fs.mkdirSync(intDir, { recursive: true });

        // Maintain clean, portable templates for mcp_config.json and hooks.json without secrets
        const mcpTemplatePath = path.join(intDir, 'mcp_config.json');
        const mcpTemplate = {
            mcpServers: {
                "second-brain": {
                    command: "node",
                    args: ["{{BRAIN_DIR}}/mcp_server.js"]
                }
            }
        };
        fs.writeFileSync(mcpTemplatePath, JSON.stringify(mcpTemplate, null, 2), 'utf8');

        const hooksTemplatePath = path.join(intDir, 'hooks.json');
        const hooksTemplate = {
            "second-brain": {
                "PreInvocation": [{ "type": "command", "command": "node \"{{BRAIN_DIR}}/hooks/pre_invocation.js\"", "timeout": 5 }],
                "PostInvocation": [{ "type": "command", "command": "node \"{{BRAIN_DIR}}/hooks/post_invocation.js\"", "timeout": 10 }],
                "Stop": [{ "type": "command", "command": "node \"{{BRAIN_DIR}}/hooks/stop.js\"", "timeout": 15 }]
            }
        };
        fs.writeFileSync(hooksTemplatePath, JSON.stringify(hooksTemplate, null, 2), 'utf8');

        // Copy all Antigravity skills (including superpowers, second-brain, ponytail...)
        const os = require('node:os');
        const geminiDir = process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini');
        const skillsSrcDir = path.join(geminiDir, 'config', 'skills');
        const intSkillsDir = path.join(intDir, 'skills');

        const copyDirRecursive = (src, dest) => {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (const entry of entries) {
                const s = path.join(src, entry.name);
                const d = path.join(dest, entry.name);
                if (entry.isDirectory()) {
                    copyDirRecursive(s, d);
                } else {
                    fs.copyFileSync(s, d);
                }
            }
        };

        if (fs.existsSync(skillsSrcDir)) {
            if (!fs.existsSync(intSkillsDir)) fs.mkdirSync(intSkillsDir, { recursive: true });
            const skillEntries = fs.readdirSync(skillsSrcDir, { withFileTypes: true });
            for (const entry of skillEntries) {
                if (entry.isDirectory()) {
                    copyDirRecursive(path.join(skillsSrcDir, entry.name), path.join(intSkillsDir, entry.name));
                }
            }
        }

        // Copy GEMINI.md global rules
        const rulesPath = path.join(geminiDir, 'config', 'GEMINI.md');
        if (fs.existsSync(rulesPath)) {
            fs.copyFileSync(rulesPath, path.join(intDir, 'GEMINI.md'));
        }

        // Copy MCP schemas
        const mcpSchemasDir = path.join(geminiDir, 'antigravity', 'mcp', 'second-brain');
        if (fs.existsSync(mcpSchemasDir)) {
            const intSchemasDir = path.join(intDir, 'mcp_schemas');
            if (!fs.existsSync(intSchemasDir)) fs.mkdirSync(intSchemasDir, { recursive: true });
            const files = fs.readdirSync(mcpSchemasDir);
            for (const f of files) {
                fs.copyFileSync(path.join(mcpSchemasDir, f), path.join(intSchemasDir, f));
            }
        }
    }

    commitBackup(customMessage = null) {
        if (!this.isRepoInitialized()) {
            this.initRepo();
        }

        // Export latest data snapshots
        const stats = this.exportDataSnapshot();

        // Stage all relevant files
        this._execGit('add .');

        // Check if there are changes to commit
        const statusOutput = this._execGit('status --porcelain');
        if (!statusOutput) {
            return {
                success: true,
                committed: false,
                message: 'Không có thay đổi mới kể từ bản sao lưu trước đó.',
                stats
            };
        }

        const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
        const commitMsg = customMessage || `Backup [${timestamp}]: ${stats.profileCount} profile, ${stats.knowledgeCount} knowledge, ${stats.solutionsCount} solutions, ${stats.conversationsCount} convs`;

        try {
            this._execGit(`commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
            const lastCommit = this._execGit('log -1 --pretty=format:"%h - %s (%cr)"');
            return {
                success: true,
                committed: true,
                commit: lastCommit,
                stats
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    }

    pushRemote() {
        if (!this.isRepoInitialized()) {
            return { success: false, error: 'Kho lưu trữ Git chưa được khởi tạo.' };
        }

        try {
            const remoteUrl = this._execGit('remote get-url origin');
            if (!remoteUrl) {
                return { success: false, error: 'Chưa cấu hình remote origin.' };
            }
            const pushResult = this._execGit('push -u origin main');
            return { success: true, message: 'Đã đẩy thành công lên remote origin.', details: pushResult };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    pullRemote() {
        if (!this.isRepoInitialized()) {
            return { success: false, error: 'Kho lưu trữ Git chưa được khởi tạo.' };
        }

        try {
            const remoteUrl = this._execGit('remote get-url origin');
            if (!remoteUrl) {
                return { success: false, error: 'Chưa cấu hình remote origin.' };
            }

            // Pull latest commits with rebase to cleanly fast-forward dual-boot commits
            let pullResult = '';
            try {
                pullResult = this._execGit('pull --rebase origin main');
            } catch (e) {
                pullResult = this._execGit('pull origin main');
            }

            // Force SQLite to checkpoint newly pulled DB changes
            try {
                const db = getDB();
                db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
            } catch (e) {}

            return { success: true, message: 'Đã kéo cập nhật thành công từ remote origin.', details: pullResult };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    importDump(dumpFilePath = null) {
        const targetPath = dumpFilePath || path.join(this.exportsDir, 'dump.sql');
        if (!fs.existsSync(targetPath)) {
            return { success: false, error: 'Không tìm thấy tệp dump.sql' };
        }

        try {
            const db = getDB();
            const sql = fs.readFileSync(targetPath, 'utf8');
            db.exec(sql);
            db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
            return { success: true, message: 'Đã nạp thành công toàn bộ dữ liệu từ dump.sql vào CSDL SQLite.' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    syncRemote(customMessage = null) {
        if (!this.isRepoInitialized()) {
            return { success: false, error: 'Kho lưu trữ Git chưa được khởi tạo.' };
        }

        // 1. Commit local changes if any
        const commitRes = this.commitBackup(customMessage);

        // 2. Pull remote updates
        const pullRes = this.pullRemote();

        // 3. Push to remote
        const pushRes = this.pushRemote();

        return {
            success: (commitRes.success !== false) && pullRes.success && pushRes.success,
            commit: commitRes,
            pull: pullRes,
            push: pushRes
        };
    }

    setRemote(url) {
        if (!this.isRepoInitialized()) {
            this.initRepo();
        }

        try {
            let hasOrigin = false;
            try {
                this._execGit('remote get-url origin');
                hasOrigin = true;
            } catch (e) {
                hasOrigin = false;
            }

            if (hasOrigin) {
                this._execGit(`remote set-url origin ${url}`);
            } else {
                this._execGit(`remote add origin ${url}`);
            }
            return { success: true, remoteUrl: url };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    getStatus() {
        const gitAvail = this.isGitAvailable();
        if (!gitAvail.available) {
            return { gitAvailable: false, error: gitAvail.error };
        }

        if (!this.isRepoInitialized()) {
            return { gitAvailable: true, initialized: false, version: gitAvail.version };
        }

        let branch = 'unknown';
        let lastCommit = 'Chưa có commit';
        let remoteUrl = null;
        let modifiedFiles = [];

        try {
            branch = this._execGit('branch --show-current');
        } catch (e) {}

        try {
            lastCommit = this._execGit('log -1 --pretty=format:"%h - %s (%cd)" --date=relative');
        } catch (e) {}

        try {
            remoteUrl = this._execGit('remote get-url origin');
        } catch (e) {}

        try {
            const rawStatus = this._execGit('status --porcelain');
            if (rawStatus) {
                modifiedFiles = rawStatus.split('\n').filter(Boolean);
            }
        } catch (e) {}

        return {
            gitAvailable: true,
            initialized: true,
            version: gitAvail.version,
            branch,
            lastCommit,
            remoteUrl,
            uncommittedCount: modifiedFiles.length,
            modifiedFiles: modifiedFiles.slice(0, 10)
        };
    }
}

let instance = null;

function getGitBackupManager() {
    if (!instance) {
        instance = new GitBackupManager();
    }
    return instance;
}

module.exports = {
    GitBackupManager,
    getGitBackupManager,
    EXPORTS_DIR
};
