// ==============================================================================
// Antigravity Second Brain: Git Automated Backup & Version Control Subsystem
// Production-grade v3.7 Hardened Engine: Parameterized Execution, Staging Allowlist,
// Pre-Commit Secret Scanner, Complete 100% Data Tiers & Self-Healing Restore
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getDB, BRAIN_DIR } = require('./db');
const { GitSyncLock } = require('./git_lock');

const EXPORTS_DIR = path.join(BRAIN_DIR, 'exports');

const ALLOWED_EXPORT_FILES = [
    'profile.json',
    'profile.md',
    'knowledge.json',
    'solutions.json',
    'conversations_summary.json',
    'episodes_log.json',
    'entities.json',
    'entity_relations.json',
    'dump.sql',
    'dashboard.html',
    'README.md',
    '.gitignore',
    // Backward compatibility aliases
    'exports/profile.json',
    'exports/knowledge.json',
    'exports/solutions.json',
    'exports/conversations_summary.json',
    'exports/episodes_log.json',
    'exports/entities.json',
    'exports/entity_relations.json',
    'exports/dump.sql'
];

class GitBackupManager {
    constructor(brainDir = BRAIN_DIR, exportsDir = EXPORTS_DIR, db = null) {
        if (brainDir && typeof brainDir === 'object' && typeof brainDir.get === 'function') {
            this.db = brainDir;
            this.brainDir = BRAIN_DIR;
            this.exportsDir = EXPORTS_DIR;
        } else {
            this.brainDir = brainDir || BRAIN_DIR;
            this.exportsDir = exportsDir || EXPORTS_DIR;
            this.db = db;
        }
        this.dataDir = this.exportsDir;
        this.gitCmd = this._resolveGitCommand();

        if (!fs.existsSync(this.exportsDir)) {
            fs.mkdirSync(this.exportsDir, { recursive: true });
        }
    }

    _resolveGitCommand() {
        try {
            const res = spawnSync('git', ['--version'], { stdio: 'ignore' });
            if (res.status === 0) return 'git';
        } catch (e) {}

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
                return p;
            }
        }

        return 'git';
    }

    /**
     * Executes git commands securely using argument arrays.
     * Prevents shell injection by bypassing shell command concatenation entirely.
     */
    _execGit(args = [], options = {}) {
        if (!Array.isArray(args)) {
            throw new TypeError('Git arguments must be an array of strings');
        }
        const cwd = options.cwd || this.exportsDir;
        const result = spawnSync(this.gitCmd, args, {
            cwd,
            encoding: 'utf8',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
            stdio: ['ignore', 'pipe', 'pipe'],
            ...options
        });

        if (result.error) throw result.error;
        if (result.status !== 0) {
            const errOutput = (result.stderr || result.stdout || '').trim();
            throw new Error(`Git exited with code ${result.status}: ${errOutput}`);
        }
        return (result.stdout || '').trim();
    }

    /**
     * Pre-commit Secret Scanner
     * Audits file content for leaked private keys, API tokens, and credentials.
     */
    scanForSecrets(filePath) {
        if (!fs.existsSync(filePath)) return null;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const SECRET_PATTERNS = [
                { name: 'Private Key', regex: /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----/ },
                { name: 'GitHub Token', regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/ },
                { name: 'OpenAI/Anthropic API Key', regex: /sk-(?:live|proj|ant)-[A-Za-z0-9_-]{20,}/ },
                { name: 'Slack Token', regex: /(?:xoxb|xoxp|xapp)-[A-Za-z0-9-]{20,}/ },
                { name: 'AWS Access Key', regex: /(?:AKIA|ABIA|ACCA)[0-9A-Z]{16}/ }
            ];

            for (const p of SECRET_PATTERNS) {
                if (p.regex.test(content)) {
                    return { file: filePath, pattern: p.name };
                }
            }
        } catch (e) {}
        return null;
    }

    isGitAvailable() {
        try {
            const version = this._execGit(['--version']);
            return { available: true, version };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    isRepoInitialized(targetDir = this.exportsDir) {
        return fs.existsSync(path.join(targetDir, '.git'));
    }

    initRepo(targetDir = this.exportsDir) {
        if (this.isRepoInitialized(targetDir)) {
            return { initialized: true, alreadyExisted: true };
        }
        try {
            this._execGit(['init', '-b', 'main'], { cwd: targetDir });
        } catch (e) {
            this._execGit(['init'], { cwd: targetDir });
            try {
                this._execGit(['branch', '-M', 'main'], { cwd: targetDir });
            } catch (err) {}
        }

        // Configure fallback local Git identity for headless CI and new environments
        try {
            this._execGit(['config', 'user.name', 'Antigravity Second Brain'], { cwd: targetDir });
            this._execGit(['config', 'user.email', 'second-brain@antigravity.local'], { cwd: targetDir });
        } catch (idErr) {}

        return { initialized: true, alreadyExisted: false };
    }

    exportDataSnapshot() {
        const db = this.db || getDB();

        // 0. Force checkpoint SQLite WAL into main brain.db file
        try {
            db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        } catch (e) {}

        // 1. Export Profile (Hồ sơ cá nhân)
        const profileRows = db.all('SELECT category, key, value, confidence, source, updated_at FROM user_profile ORDER BY category, key');
        const profilePath = path.join(this.exportsDir, 'profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(profileRows, null, 2), 'utf8');

        // 2. Export Knowledge Items (không kèm raw embedding BLOB để giữ text diff sạch)
        const knowledgeRows = db.all('SELECT id, title, content, category, tags, source, importance, project_scope, trust_level, confidence, verification_status, last_verified_at, created_at, updated_at FROM knowledge_items ORDER BY id ASC');
        const knowledgePath = path.join(this.exportsDir, 'knowledge.json');
        fs.writeFileSync(knowledgePath, JSON.stringify(knowledgeRows, null, 2), 'utf8');

        // 3. Export Solutions (Procedural memory)
        const solutionRows = db.all('SELECT id, error_pattern, root_cause, solution_code, command_fix, project_scope, confidence, success_count, trust_level, verification_status, last_verified_at, created_at FROM solutions ORDER BY id ASC');
        const solutionsPath = path.join(this.exportsDir, 'solutions.json');
        fs.writeFileSync(solutionsPath, JSON.stringify(solutionRows, null, 2), 'utf8');

        // 4. Export Conversations Summary
        const convRows = db.all('SELECT id, title, summary, message_count, updated_at FROM conversations ORDER BY updated_at DESC');
        const convPath = path.join(this.exportsDir, 'conversations_summary.json');
        fs.writeFileSync(convPath, JSON.stringify(convRows, null, 2), 'utf8');

        // 4.5. Export Episodes (Episodic memory - Lịch sử hội thoại đầy đủ kèm nội dung content)
        const episodeRows = db.all('SELECT id, conversation_id, step_index, role, content, summary, tags, timestamp FROM episodes ORDER BY id ASC');
        const epPath = path.join(this.exportsDir, 'episodes_log.json');
        fs.writeFileSync(epPath, JSON.stringify(episodeRows, null, 2), 'utf8');

        // 4.6. Export Entities (Knowledge Graph Entities)
        const entityRows = db.all('SELECT id, name, type, description, created_at, updated_at FROM entities ORDER BY id ASC');
        const entPath = path.join(this.exportsDir, 'entities.json');
        fs.writeFileSync(entPath, JSON.stringify(entityRows, null, 2), 'utf8');

        // 5. Generate 100% Comprehensive Human-Readable SQL Dump
        let sqlDump = `-- Antigravity Second Brain SQL Dump\n-- Generated: ${new Date().toISOString()}\n\n`;
        
        // Profile inserts
        sqlDump += `-- Table: user_profile\n`;
        for (const row of profileRows) {
            const val = (row.value || '').replace(/'/g, "''");
            sqlDump += `INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source) VALUES ('${row.category}', '${row.key}', '${val}', ${row.confidence}, '${row.source}');\n`;
        }

        // Entities inserts
        if (entityRows && entityRows.length > 0) {
            sqlDump += `\n-- Table: entities\n`;
            for (const row of entityRows) {
                const name = (row.name || '').replace(/'/g, "''");
                const type = (row.type || '').replace(/'/g, "''");
                const desc = (row.description || '').replace(/'/g, "''");
                sqlDump += `INSERT OR REPLACE INTO entities (id, name, type, description) VALUES (${row.id}, '${name}', '${type}', '${desc}');\n`;
            }
        }

        sqlDump += `\n-- Table: knowledge_items\n`;
        for (const row of knowledgeRows) {
            const title = (row.title || '').replace(/'/g, "''");
            const content = (row.content || '').replace(/'/g, "''");
            const tags = (row.tags || '').replace(/'/g, "''");
            const trust = (row.trust_level || 'medium').replace(/'/g, "''");
            const conf = row.confidence !== undefined && row.confidence !== null ? row.confidence : 0.8;
            const status = (row.verification_status || 'candidate').replace(/'/g, "''");
            const lastVer = row.last_verified_at ? `'${row.last_verified_at.replace(/'/g, "''")}'` : 'NULL';
            sqlDump += `INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope, trust_level, confidence, verification_status, last_verified_at) VALUES (${row.id}, '${title}', '${content}', '${row.category}', '${tags}', '${row.source}', ${row.importance}, '${row.project_scope}', '${trust}', ${conf}, '${status}', ${lastVer});\n`;
        }

        sqlDump += `\n-- Table: solutions\n`;
        for (const row of solutionRows) {
            const errP = (row.error_pattern || '').replace(/'/g, "''");
            const solC = (row.solution_code || '').replace(/'/g, "''");
            const root = (row.root_cause || '').replace(/'/g, "''");
            const cmd = (row.command_fix || '').replace(/'/g, "''");
            const trust = (row.trust_level || 'medium').replace(/'/g, "''");
            const status = (row.verification_status || 'candidate').replace(/'/g, "''");
            const lastVer = row.last_verified_at ? `'${row.last_verified_at.replace(/'/g, "''")}'` : 'NULL';
            sqlDump += `INSERT OR REPLACE INTO solutions (id, error_pattern, root_cause, solution_code, command_fix, project_scope, confidence, success_count, trust_level, verification_status, last_verified_at) VALUES (${row.id}, '${errP}', '${root}', '${solC}', '${cmd}', '${row.project_scope}', ${row.confidence}, ${row.success_count}, '${trust}', '${status}', ${lastVer});\n`;
        }

        sqlDump += `\n-- Table: conversations\n`;
        for (const row of convRows) {
            const title = (row.title || '').replace(/'/g, "''");
            const sum = (row.summary || '').replace(/'/g, "''");
            sqlDump += `INSERT OR REPLACE INTO conversations (id, title, summary, message_count) VALUES ('${row.id}', '${title}', '${sum}', ${row.message_count});\n`;
        }

        // Episodes inserts (Episodic Memory Tier 2)
        if (episodeRows && episodeRows.length > 0) {
            sqlDump += `\n-- Table: episodes\n`;
            for (const row of episodeRows) {
                const cid = (row.conversation_id || '').replace(/'/g, "''");
                const role = (row.role || '').replace(/'/g, "''");
                const content = (row.content || '').replace(/'/g, "''");
                const sum = (row.summary || '').replace(/'/g, "''");
                const tags = (row.tags || '').replace(/'/g, "''");
                sqlDump += `INSERT OR REPLACE INTO episodes (id, conversation_id, step_index, role, content, summary, tags, timestamp) VALUES (${row.id}, '${cid}', ${row.step_index}, '${role}', '${content}', '${sum}', '${tags}', '${row.timestamp}');\n`;
            }
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
                // Export entity_relations.json
                const relJsonPath = path.join(this.exportsDir, 'entity_relations.json');
                fs.writeFileSync(relJsonPath, JSON.stringify(relationRows, null, 2), 'utf8');

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

        // 5.6. Copy profile.md if present
        const profileMdSrc = path.join(this.brainDir, 'profile.md');
        const profileMdDest = path.join(this.exportsDir, 'profile.md');
        if (fs.existsSync(profileMdSrc) && !fs.existsSync(profileMdDest)) {
            try { fs.copyFileSync(profileMdSrc, profileMdDest); } catch (e) {}
        }

        // 6. Ensure default README.md and .gitignore exist in exports
        const readmePath = path.join(this.exportsDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(readmePath, '# Antigravity Second Brain — Private Cognitive Memory Store\n\nPrivate cognitive state and memory store for Antigravity Second Brain.\n', 'utf8');
        }
        const gitignorePath = path.join(this.exportsDir, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            fs.writeFileSync(gitignorePath, '*.tmp\n*.log\n.DS_Store\nThumbs.db\n', 'utf8');
        }

        // 7. Verify templates in engine repo
        this._bundleIntegrations();

        return {
            success: true,
            profileCount: profileRows.length,
            knowledgeCount: knowledgeRows.length,
            solutionsCount: solutionRows.length,
            conversationsCount: convRows.length,
            episodesCount: episodeRows ? episodeRows.length : 0,
            entitiesCount: entityRows ? entityRows.length : 0,
            exportedFiles: ['profile.json', 'knowledge.json', 'solutions.json', 'conversations_summary.json', 'episodes_log.json', 'entities.json', 'entity_relations.json', 'dump.sql']
        };
    }

    exportData() {
        return this.exportDataSnapshot();
    }

    _bundleIntegrations() {
        const intDir = path.join(this.brainDir, 'integrations');
        if (!fs.existsSync(intDir)) fs.mkdirSync(intDir, { recursive: true });

        // Maintain clean, portable templates for mcp_config.json and hooks.json without secrets
        const mcpTemplatePath = path.join(intDir, 'mcp_config.json');
        if (!fs.existsSync(mcpTemplatePath)) {
            const mcpTemplate = {
                mcpServers: {
                    "second-brain": {
                        command: "node",
                        args: ["{{BRAIN_DIR}}/mcp_server.js"]
                    }
                }
            };
            fs.writeFileSync(mcpTemplatePath, JSON.stringify(mcpTemplate, null, 2), 'utf8');
        }

        const hooksTemplatePath = path.join(intDir, 'hooks.json');
        if (!fs.existsSync(hooksTemplatePath)) {
            const hooksTemplate = {
                "second-brain": {
                    "PreInvocation": [{ "type": "command", "command": "node \"{{BRAIN_DIR}}/hooks/pre_invocation.js\"", "timeout": 5 }],
                    "PostInvocation": [{ "type": "command", "command": "node \"{{BRAIN_DIR}}/hooks/post_invocation.js\"", "timeout": 10 }],
                    "Stop": [{ "type": "command", "command": "node \"{{BRAIN_DIR}}/hooks/stop.js\"", "timeout": 15 }]
                }
            };
            fs.writeFileSync(hooksTemplatePath, JSON.stringify(hooksTemplate, null, 2), 'utf8');
        }
    }

    commitBackup(customMessage = null) {
        if (!this.isRepoInitialized(this.exportsDir)) {
            this.initRepo(this.exportsDir);
        }

        // Export latest data snapshots into exports/
        const stats = this.exportDataSnapshot();

        // 1. Audit exports with Pre-Commit Secret Scanner
        const filesInExports = fs.readdirSync(this.exportsDir);
        for (const fileName of filesInExports) {
            const fullPath = path.join(this.exportsDir, fileName);
            const secretLeak = this.scanForSecrets(fullPath);
            if (secretLeak) {
                return {
                    success: false,
                    committed: false,
                    error: `Secret Scanner Alert: Detected sensitive pattern [${secretLeak.pattern}] in ${fileName}. Commit safely aborted to prevent credential leakage.`
                };
            }
        }

        // 2. Stage strictly using Allowlist inside exportsDir
        const filesToStage = filesInExports.filter(f => {
            const base = path.basename(f);
            return ALLOWED_EXPORT_FILES.some(allowed => path.basename(allowed) === base);
        });

        if (filesToStage.length === 0) {
            return {
                success: true,
                committed: false,
                message: 'No export files found to stage.',
                stats
            };
        }

        this._execGit(['add', '--', ...filesToStage], { cwd: this.exportsDir });

        // Check if there are changes to commit
        const statusOutput = this._execGit(['status', '--porcelain', '--', ...filesToStage], { cwd: this.exportsDir });
        if (!statusOutput) {
            return {
                success: true,
                committed: false,
                message: 'No new changes detected since previous backup snapshot.',
                stats
            };
        }

        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const commitMsg = customMessage || `chore(backup): snapshot [${timestamp}] (${stats.profileCount} profile, ${stats.knowledgeCount} knowledge, ${stats.solutionsCount} solutions)`;

        try {
            this._execGit(['commit', '-m', commitMsg], { cwd: this.exportsDir });
            const lastCommit = this._execGit(['log', '-1', '--pretty=format:%h - %s (%cr)'], { cwd: this.exportsDir });
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
        if (!this.isRepoInitialized(this.exportsDir)) {
            return { success: false, error: 'Kho lưu trữ Git private data chưa được khởi tạo.' };
        }

        try {
            const remoteUrl = this._execGit(['remote', 'get-url', 'origin'], { cwd: this.exportsDir });
            if (!remoteUrl) {
                return { success: false, error: 'Chưa cấu hình remote origin cho private data repo.' };
            }
            const pushResult = this._execGit(['push', '-u', 'origin', 'main'], { cwd: this.exportsDir });
            return { success: true, message: 'Đã đẩy thành công lên remote origin.', details: pushResult };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    pullRemote() {
        if (!this.isRepoInitialized(this.exportsDir)) {
            return { success: false, error: 'Kho lưu trữ Git private data chưa được khởi tạo.' };
        }

        try {
            const remoteUrl = this._execGit(['remote', 'get-url', 'origin'], { cwd: this.exportsDir });
            if (!remoteUrl) {
                return { success: false, error: 'Chưa cấu hình remote origin cho private data repo.' };
            }

            let pullResult = '';
            try {
                pullResult = this._execGit(['pull', '--rebase', 'origin', 'main'], { cwd: this.exportsDir });
            } catch (e) {
                pullResult = this._execGit(['pull', 'origin', 'main'], { cwd: this.exportsDir });
            }

            // After pulling data, restore database and trigger backfill
            const importRes = this.importDump();
            if (!importRes || importRes.success === false) {
                return {
                    success: false,
                    error: `Git pull thành công nhưng phục hồi CSDL thất bại: ${importRes ? importRes.error : 'Unknown restore error'}`,
                    details: pullResult,
                    import: importRes
                };
            }

            return {
                success: true,
                message: 'Đã kéo cập nhật thành công từ remote origin và đồng bộ CSDL SQLite.',
                details: pullResult,
                import: importRes
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    importDump(dumpFilePath = null) {
        const targetPath = dumpFilePath || path.join(this.exportsDir, 'dump.sql');
        if (!fs.existsSync(targetPath)) {
            return { success: false, error: 'Không tìm thấy tệp dump.sql' };
        }

        const db = this.db || getDB();
        try {
            const sql = fs.readFileSync(targetPath, 'utf8');
            if (!sql || !sql.trim()) {
                return { success: false, error: 'Tệp dump.sql trống' };
            }

            // Atomic transactional restore: abort & rollback on any syntax or schema violation
            db.exec('BEGIN IMMEDIATE;');
            try {
                db.exec(sql);
                const integrityRow = db.get('PRAGMA integrity_check;');
                const integrityStatus = integrityRow ? (integrityRow.integrity_check || Object.values(integrityRow)[0]) : 'ok';
                if (integrityStatus !== 'ok') {
                    throw new Error(`Kiểm tra toàn vẹn CSDL thất bại (integrity_check): ${integrityStatus}`);
                }
                db.exec('COMMIT;');
            } catch (innerErr) {
                try { db.exec('ROLLBACK;'); } catch (rbErr) {}
                throw innerErr;
            }

            db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

            // Rebuild FTS Virtual Tables for 100% Search Index Parity
            try {
                db.exec("INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild');");
                db.exec("INSERT INTO episodes_fts(episodes_fts) VALUES('rebuild');");
                db.exec("INSERT INTO solutions_fts(solutions_fts) VALUES('rebuild');");
            } catch (ftsErr) {}

            const counts = {
                profile: db.get('SELECT COUNT(*) as c FROM user_profile').c,
                knowledge: db.get('SELECT COUNT(*) as c FROM knowledge_items').c,
                solutions: db.get('SELECT COUNT(*) as c FROM solutions').c,
                conversations: db.get('SELECT COUNT(*) as c FROM conversations').c,
                episodes: db.get('SELECT COUNT(*) as c FROM episodes').c,
                entities: db.get('SELECT COUNT(*) as c FROM entities').c,
                relations: db.get('SELECT COUNT(*) as c FROM entity_relations').c
            };

            // Asynchronously trigger embedding backfill if missing vectors exist
            try {
                const { getSemanticKnowledge } = require('./semantic');
                const sem = getSemanticKnowledge(db);
                sem._backfillEmbeddings().catch(() => {});
            } catch (e) {}

            return { 
                success: true, 
                message: 'Đã nạp thành công toàn bộ dữ liệu từ dump.sql vào CSDL SQLite.',
                counts
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    restoreFromJSON(sourceDir = null) {
        const targetDir = sourceDir || this.exportsDir;
        const db = this.db || getDB();

        try {
            db.exec('BEGIN IMMEDIATE;');

            // 1. Restore user_profile
            const profileFile = path.join(targetDir, 'profile.json');
            if (fs.existsSync(profileFile)) {
                const profiles = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
                const stmtP = db.prepare(`
                    INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source)
                    VALUES (?, ?, ?, ?, ?)
                `);
                for (const p of profiles) {
                    stmtP.run(p.category, p.key, String(p.value || ''), p.confidence !== undefined ? p.confidence : 1.0, p.source || 'user');
                }
            }

            // 2. Restore entities
            const entFile = path.join(targetDir, 'entities.json');
            if (fs.existsSync(entFile)) {
                const entities = JSON.parse(fs.readFileSync(entFile, 'utf8'));
                const stmtE = db.prepare(`
                    INSERT OR REPLACE INTO entities (id, name, type, description)
                    VALUES (?, ?, ?, ?)
                `);
                for (const e of entities) {
                    stmtE.run(e.id, e.name, e.type || 'concept', e.description || '');
                }
            }

            // 3. Restore entity_relations
            const relFile = path.join(targetDir, 'entity_relations.json');
            if (fs.existsSync(relFile)) {
                const relations = JSON.parse(fs.readFileSync(relFile, 'utf8'));
                const stmtR = db.prepare(`
                    INSERT OR REPLACE INTO entity_relations (source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                for (const r of relations) {
                    stmtR.run(r.source_entity, r.relation, r.target_entity, r.confidence !== undefined ? r.confidence : 1.0, r.valid_from || new Date().toISOString(), r.valid_until || null, r.metadata || '{}');
                }
            }

            // 4. Restore knowledge_items
            const kFile = path.join(targetDir, 'knowledge.json');
            if (fs.existsSync(kFile)) {
                const items = JSON.parse(fs.readFileSync(kFile, 'utf8'));
                const stmtK = db.prepare(`
                    INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, project_scope, trust_level, confidence, verification_status, last_verified_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                for (const k of items) {
                    stmtK.run(
                        k.id, k.title, k.content, k.category, k.tags || '', k.source || 'user',
                        k.importance !== undefined ? k.importance : 1.0,
                        k.project_scope || 'global',
                        k.trust_level || 'medium',
                        k.confidence !== undefined ? k.confidence : 0.8,
                        k.verification_status || 'candidate',
                        k.last_verified_at || null
                    );
                }
            }

            // 5. Restore solutions
            const solFile = path.join(targetDir, 'solutions.json');
            if (fs.existsSync(solFile)) {
                const solutions = JSON.parse(fs.readFileSync(solFile, 'utf8'));
                const stmtS = db.prepare(`
                    INSERT OR REPLACE INTO solutions (id, error_pattern, root_cause, solution_code, command_fix, project_scope, confidence, success_count, trust_level, verification_status, last_verified_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                for (const s of solutions) {
                    stmtS.run(
                        s.id, s.error_pattern, s.root_cause || '', s.solution_code,
                        s.command_fix || '', s.project_scope || 'global',
                        s.confidence !== undefined ? s.confidence : 1.0,
                        s.success_count || 1,
                        s.trust_level || 'medium',
                        s.verification_status || 'candidate',
                        s.last_verified_at || null
                    );
                }
            }

            // 6. Restore conversations
            const convFile = path.join(targetDir, 'conversations_summary.json');
            if (fs.existsSync(convFile)) {
                const convs = JSON.parse(fs.readFileSync(convFile, 'utf8'));
                const stmtC = db.prepare(`
                    INSERT OR REPLACE INTO conversations (id, title, summary, message_count)
                    VALUES (?, ?, ?, ?)
                `);
                for (const c of convs) {
                    stmtC.run(c.id, c.title, c.summary || '', c.message_count || 0);
                }
            }

            // Check integrity
            const integrityRow = db.get('PRAGMA integrity_check;');
            const integrityStatus = integrityRow ? (integrityRow.integrity_check || Object.values(integrityRow)[0]) : 'ok';
            if (integrityStatus !== 'ok') {
                throw new Error(`Integrity check failed: ${integrityStatus}`);
            }

            db.exec('COMMIT;');

            try {
                db.exec("INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild');");
                db.exec("INSERT INTO episodes_fts(episodes_fts) VALUES('rebuild');");
                db.exec("INSERT INTO solutions_fts(solutions_fts) VALUES('rebuild');");
            } catch (e) {}

            return { success: true, message: 'Restore from JSON snapshots completed idempotently.' };
        } catch (err) {
            try { db.exec('ROLLBACK;'); } catch (rb) {}
            return { success: false, error: err.message };
        }
    }

    syncRemote(customMessage = null) {
        if (!this.isRepoInitialized(this.exportsDir)) {
            return { success: false, error: 'Kho lưu trữ Git private data chưa được khởi tạo.' };
        }

        const lockPath = path.join(this.brainDir, '.git-sync.lock');
        const lock = new GitSyncLock(lockPath);
        if (!lock.acquire(15000)) {
            return { success: false, error: 'Đang có một tiến trình đồng bộ Git khác chạy ngầm.' };
        }

        try {
            const commitRes = this.commitBackup(customMessage);
            const pullRes = this.pullRemote();
            const pushRes = this.pushRemote();

            return {
                success: (commitRes.success !== false) && pullRes.success && pushRes.success,
                commit: commitRes,
                pull: pullRes,
                push: pushRes
            };
        } finally {
            lock.release();
        }
    }

    setRemote(url, targetDir = this.exportsDir) {
        if (!this.isRepoInitialized(targetDir)) {
            this.initRepo(targetDir);
        }

        if (!url || typeof url !== 'string') {
            return { success: false, error: 'Remote URL không được để trống.' };
        }

        const sanitizedUrl = url.trim();
        // Validate URL format to prevent shell tricks or invalid URLs
        if (!/^(?:https?:\/\/|git@|ssh:\/\/)[A-Za-z0-9_.~:/?#\[\]@!$&'()*+,;=-]+$/.test(sanitizedUrl)) {
            return { success: false, error: 'Định dạng Git Remote URL không hợp lệ hoặc chứa ký tự không an toàn.' };
        }

        try {
            let hasOrigin = false;
            try {
                this._execGit(['remote', 'get-url', 'origin'], { cwd: targetDir });
                hasOrigin = true;
            } catch (e) {
                hasOrigin = false;
            }

            if (hasOrigin) {
                this._execGit(['remote', 'set-url', 'origin', sanitizedUrl], { cwd: targetDir });
            } else {
                this._execGit(['remote', 'add', 'origin', sanitizedUrl], { cwd: targetDir });
            }
            return { success: true, remoteUrl: sanitizedUrl };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    getStatus(targetDir = this.exportsDir) {
        const gitAvail = this.isGitAvailable();
        if (!gitAvail.available) {
            return { gitAvailable: false, error: gitAvail.error };
        }

        if (!this.isRepoInitialized(targetDir)) {
            return { gitAvailable: true, initialized: false, version: gitAvail.version };
        }

        let branch = 'unknown';
        let lastCommit = 'Chưa có commit';
        let remoteUrl = null;
        let modifiedFiles = [];

        try {
            branch = this._execGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: targetDir });
        } catch (e) {}

        try {
            lastCommit = this._execGit(['log', '-1', '--pretty=format:%h - %s (%cd)', '--date=relative'], { cwd: targetDir });
        } catch (e) {}

        try {
            remoteUrl = this._execGit(['remote', 'get-url', 'origin'], { cwd: targetDir });
        } catch (e) {}

        try {
            const rawStatus = this._execGit(['status', '--porcelain'], { cwd: targetDir });
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
            modifiedFiles: modifiedFiles.slice(0, 10),
            isDataRepo: targetDir === this.exportsDir
        };
    }

    getEngineStatus() {
        return this.getStatus(this.brainDir);
    }

    getDataStatus() {
        return this.getStatus(this.exportsDir);
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
    EXPORTS_DIR,
    ALLOWED_EXPORT_FILES
};
