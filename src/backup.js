// ==============================================================================
// Antigravity Second Brain: Automated Snapshot & Backup Engine
// Uses SQLite VACUUM INTO for 100% atomic, consistent, live hot-backups
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getDB, BRAIN_DIR, DB_PATH } = require('./db');

const BACKUP_DIR = path.join(BRAIN_DIR, 'backups');
const MAX_BACKUPS = 10; // Keep latest 10 snapshots

class BackupManager {
    constructor(db = getDB(), backupDir = BACKUP_DIR) {
        this.db = db;
        this.backupDir = backupDir;
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `brain_backup_${timestamp}.db`;
        const targetPath = path.join(this.backupDir, backupFileName);

        // Normalize path for SQLite SQL string
        const normalizedTarget = targetPath.replace(/\\/g, '/');

        try {
            // VACUUM INTO produces an atomic, zero-downtime, compacted copy of the DB
            this.db.exec(`VACUUM INTO '${normalizedTarget}';`);
            this.rotateBackups();
            return {
                success: true,
                filePath: targetPath,
                fileName: backupFileName,
                sizeBytes: fs.statSync(targetPath).size
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    }

    rotateBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith('brain_backup_') && f.endsWith('.db'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: fs.statSync(path.join(this.backupDir, f)).mtimeMs
                }))
                .sort((a, b) => b.time - a.time);

            if (files.length > MAX_BACKUPS) {
                const toDelete = files.slice(MAX_BACKUPS);
                for (const file of toDelete) {
                    fs.unlinkSync(file.path);
                }
            }
        } catch (e) {}
    }

    listBackups() {
        if (!fs.existsSync(this.backupDir)) return [];
        return fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith('brain_backup_') && f.endsWith('.db'))
            .map(f => {
                const p = path.join(this.backupDir, f);
                const stat = fs.statSync(p);
                return {
                    fileName: f,
                    path: p,
                    sizeBytes: stat.size,
                    createdAt: stat.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    shouldAutoBackup(intervalHours = 24) {
        const backups = this.listBackups();
        if (backups.length === 0) return true;
        const latest = new Date(backups[0].createdAt).getTime();
        const diffHours = (Date.now() - latest) / (1000 * 60 * 60);
        return diffHours >= intervalHours;
    }
}

let instance = null;

function getBackupManager() {
    if (!instance) {
        instance = new BackupManager();
    }
    return instance;
}

module.exports = {
    BackupManager,
    getBackupManager,
    BACKUP_DIR
};
