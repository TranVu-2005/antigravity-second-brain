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

        // Check common Windows installation locations
        const candidatePaths = [
            'C:\\Program Files\\Git\\cmd\\git.exe',
            'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'git.exe')
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                return `"${p}"`;
            }
        }

        return 'git';
    }

    _execGit(cmd) {
        return execSync(`${this.gitCmd} ${cmd}`, {
            cwd: this.brainDir,
            encoding: 'utf8',
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

        // 5. Generate Human-Readable SQL Dump
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

        const sqlDumpPath = path.join(this.exportsDir, 'dump.sql');
        fs.writeFileSync(sqlDumpPath, sqlDump, 'utf8');

        return {
            profileCount: profileRows.length,
            knowledgeCount: knowledgeRows.length,
            solutionsCount: solutionRows.length,
            conversationsCount: convRows.length,
            exportedFiles: ['profile.json', 'knowledge.json', 'solutions.json', 'conversations_summary.json', 'dump.sql']
        };
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
