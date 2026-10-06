// ==============================================================================
// Antigravity Second Brain: Tier 4 - Procedural Memory & Solution Store
// Case-Based Reasoning for Errors, Bug-fixes, and Operational Workflows
// ==============================================================================

const { getDB } = require('./db');

class SolutionStore {
    constructor(db = getDB()) {
        this.db = db;
        this._bootstrap();
    }

    _bootstrap() {
        const count = this.db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;
        if (count === 0) {
            // Seed foundational engineering solutions
            this.addSolution({
                error_pattern: "SyntaxError: missing ) after argument list / PowerShell quoting",
                root_cause: "PowerShell handles single and double quotes differently in commandline execution (-e '...'). Double quotes are stripped or escaped incorrectly.",
                solution_code: "Write script to temporary .js file or execute via cmd /c with properly escaped quotes, or use shell: true in child_process.spawnSync.",
                command_fix: "agy-node script.js OR cmd /c \"agy-node -e \\\"...\\\"\"",
                project_scope: 'global',
                tags: 'powershell,windows,quotes,nodejs',
                confidence: 1.0
            });

            this.addSolution({
                error_pattern: "spawnSync agy-node ENOENT / exit null",
                root_cause: "On Windows, agy-node is a .cmd batch script (agy-node.cmd). Spawning without shell: true fails because Windows cannot directly exec .cmd files.",
                solution_code: "Pass { shell: true } to spawn/spawnSync when executing .cmd files or invoke via cmd /c.",
                command_fix: "spawnSync('agy-node', args, { shell: true })",
                project_scope: 'global',
                tags: 'windows,spawn,cmd,nodejs',
                confidence: 1.0
            });

            this.addSolution({
                error_pattern: "SQLite is an experimental feature / ExperimentalWarning",
                root_cause: "Node.js 24 prints an experimental warning to stderr for node:sqlite. Stdout remains clean JSON.",
                solution_code: "Ignore stderr warnings during JSON parsing or filter stderr when consuming child process output.",
                command_fix: "Parse stdout only: JSON.parse(result.stdout)",
                project_scope: 'global',
                tags: 'sqlite,warning,stderr,nodejs',
                confidence: 1.0
            });
        }
    }

    addSolution({ error_pattern, root_cause = '', solution_code, command_fix = '', project_scope = 'global', tags = '', confidence = 1.0, trust_level = 'medium', verification_status = 'candidate', last_verified_at = null }) {
        const existing = this.db.get(`
            SELECT id, success_count FROM solutions 
            WHERE LOWER(TRIM(error_pattern)) = LOWER(TRIM(?))
        `, error_pattern);

        const now = new Date().toISOString();

        if (existing) {
            this.db.run(`
                UPDATE solutions 
                SET root_cause = COALESCE(?, root_cause),
                    solution_code = ?,
                    command_fix = COALESCE(?, command_fix),
                    success_count = success_count + 1,
                    confidence = MIN(1.0, confidence + 0.1),
                    verification_status = CASE WHEN success_count + 1 >= 2 THEN 'stable' ELSE verification_status END,
                    trust_level = CASE WHEN success_count + 1 >= 2 THEN 'high' ELSE trust_level END,
                    last_verified_at = CASE WHEN success_count + 1 >= 2 THEN ? ELSE last_verified_at END,
                    updated_at = ?
                WHERE id = ?
            `, root_cause, solution_code, command_fix, now, now, existing.id);
            return existing.id;
        }

        const info = this.db.run(`
            INSERT INTO solutions (error_pattern, root_cause, solution_code, command_fix, project_scope, tags, confidence, success_count, trust_level, verification_status, last_verified_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        `, error_pattern, root_cause, solution_code, command_fix, project_scope, tags, confidence, trust_level, verification_status, last_verified_at, now, now);
        return info.lastInsertRowid;
    }

    storeSolution(params) {
        return this.addSolution(params);
    }

    deleteSolution(idOrPattern) {
        if (typeof idOrPattern === 'number' || /^\d+$/.test(idOrPattern)) {
            this.db.run('DELETE FROM solutions WHERE id = ?', Number(idOrPattern));
        } else {
            this.db.run('DELETE FROM solutions WHERE error_pattern = ? OR error_pattern LIKE ?', idOrPattern, `%${idOrPattern}%`);
        }
        try {
            this.db.exec("INSERT INTO solutions_fts(solutions_fts) VALUES('rebuild');");
        } catch (e) {}
        return true;
    }

    searchSolutions(query, { project_scope = null, limit = 3 } = {}) {
        if (!query || !query.trim()) {
            const scopeFilter = project_scope ? "WHERE project_scope = ? OR project_scope = 'global'" : '';
            const params = project_scope ? [project_scope, limit] : [limit];
            return this.db.all(`SELECT * FROM solutions ${scopeFilter} ORDER BY success_count DESC, confidence DESC LIMIT ?`, ...params);
        }

        const sanitized = query.replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ').trim();
        if (!sanitized) return [];

        const STOPWORDS = new Set([
            'la', 'va', 'co', 'khong', 'cho', 'cua', 'trong', 'cac', 'nhung', 'duoc', 'de', 'nay', 
            'do', 'thi', 'the', 'nao', 'gi', 'sao', 'hoi', 'xem', 'giup', 'toi', 'minh', 'ban', 'ngai',
            'is', 'are', 'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or'
        ]);
        const meaningfulWords = sanitized.split(/\s+/).filter(Boolean).filter(w => w.length > 1 && !STOPWORDS.has(w.toLowerCase()));

        // Domain intent expansion (Ponytail & System Shortcuts)
        const lowerQuery = query.toLowerCase();
        if (/(?:tải|tai|download|tiến độ|tien do|down|part\d*|fdm)/i.test(lowerQuery)) {
            if (!meaningfulWords.some(w => /^(?:fdm|download)$/i.test(w))) {
                meaningfulWords.push('fdm', 'download');
            }
        }
        if (/(?:nhiệt độ|nhiet do|nhiệt|nhiet|temp|cpu|gpu|quạt|quat|legion)/i.test(lowerQuery)) {
            if (!meaningfulWords.some(w => /^temp$/i.test(w))) {
                meaningfulWords.push('temp');
            }
        }
        if (/(?:màn hình|man hinh|tắt màn|tat man|screenoff|offscreen|sleep|ngủ đông|ngu dong)/i.test(lowerQuery)) {
            if (!meaningfulWords.some(w => /^screenoff$/i.test(w))) {
                meaningfulWords.push('screenoff');
            }
        }

        if (meaningfulWords.length === 0) return [];

        const ftsQuery = meaningfulWords.map(w => `"${w}"*`).join(' OR ');

        try {
            const scopeFilter = project_scope ? "AND (s.project_scope = ? OR s.project_scope = 'global')" : '';
            const params = project_scope ? [ftsQuery, project_scope, limit] : [ftsQuery, limit];

            const rows = this.db.all(`
                SELECT s.*, bm25(solutions_fts) as rank
                FROM solutions_fts
                JOIN solutions s ON solutions_fts.rowid = s.id
                WHERE solutions_fts MATCH ? ${scopeFilter}
                ORDER BY rank ASC, s.success_count DESC
                LIMIT ?
            `, ...params);
            return rows;
        } catch (e) {
            // Fallback to LIKE
            const pattern = `%${sanitized}%`;
            return this.db.all(`
                SELECT * FROM solutions 
                WHERE (error_pattern LIKE ? OR root_cause LIKE ? OR tags LIKE ?)
                  AND (project_scope = ? OR project_scope = 'global')
                ORDER BY success_count DESC LIMIT ?
            `, pattern, pattern, pattern, project_scope || 'global', limit);
        }
    }

    getAll(limit = 20) {
        return this.db.all('SELECT * FROM solutions ORDER BY success_count DESC, updated_at DESC LIMIT ?', limit);
    }
}

let instance = null;

function getSolutionStore(db = getDB()) {
    const targetDb = db || getDB();
    if (!instance || instance.db !== targetDb) {
        instance = new SolutionStore(targetDb);
    }
    return instance;
}

module.exports = {
    SolutionStore,
    getSolutionStore
};
