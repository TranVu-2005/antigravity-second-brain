// ==============================================================================
// Antigravity Second Brain: Diagnostic Doctor & System Health Auditor
// Comprehensive validation of SQLite, WAL mode, FTS5, embeddings, and bitemporal tables
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getDB } = require('./db');
const { getEmbeddingHealth } = require('./embedding');

async function runDiagnostics(customDb = null) {
    const db = customDb || getDB();
    const brainDir = path.resolve(__dirname, '..');
    const report = {
        timestamp: new Date().toISOString(),
        healthy: true,
        summary: '',
        checks: [],
        warnings: [],
        metrics: {}
    };

    function addCheck(category, name, passed, details = '') {
        report.checks.push({ category, name, passed, details });
        if (!passed) report.healthy = false;
    }

    function addWarning(category, message) {
        report.warnings.push({ category, message });
    }

    // 1. Node.js Runtime Check
    const [major, minor] = process.versions.node.split('.').map(Number);
    const nodeValid = major >= 24 || (major === 22 && minor >= 5);
    addCheck('runtime', 'Node.js Version (>=22.5.0, recommended 24.x)', nodeValid, `Running ${process.version}`);
    if (major < 24) {
        addWarning('runtime', 'Node.js 24.x is the recommended production target for optimal native node:sqlite performance.');
    }

    // 2. Native SQLite & WAL Mode Check
    try {
        const journalRow = db.get('PRAGMA journal_mode;');
        const journalMode = journalRow ? (journalRow.journal_mode || Object.values(journalRow)[0]) : '';
        const walOk = ['wal', 'memory'].includes(String(journalMode).toLowerCase());
        addCheck('sqlite', 'SQLite WAL Journal Mode', walOk, `Current mode: ${journalMode}`);

        const fkRow = db.get('PRAGMA foreign_keys;');
        const fkEnabled = fkRow ? (fkRow.foreign_keys === 1 || Object.values(fkRow)[0] === 1) : false;
        addCheck('sqlite', 'Foreign Keys Enforcement', fkEnabled, fkEnabled ? 'Active' : 'Disabled');

        const integrityRow = db.get('PRAGMA integrity_check;');
        const integrityStatus = integrityRow ? (integrityRow.integrity_check || Object.values(integrityRow)[0]) : 'unknown';
        addCheck('sqlite', 'Database Integrity Check', integrityStatus === 'ok', `Integrity: ${integrityStatus}`);

        const fkCheckRows = db.all('PRAGMA foreign_key_check;');
        addCheck('sqlite', 'Foreign Key Violations Check', fkCheckRows.length === 0, `${fkCheckRows.length} foreign key violations`);
    } catch (e) {
        addCheck('sqlite', 'SQLite Configuration', false, e.message);
    }

    // 3. FTS5 Virtual Tables Check
    try {
        const kFts = db.get('SELECT COUNT(*) as cnt FROM knowledge_fts');
        const eFts = db.get('SELECT COUNT(*) as cnt FROM episodes_fts');
        const sFts = db.get('SELECT COUNT(*) as cnt FROM solutions_fts');
        addCheck('fts5', 'Full-Text Search Virtual Tables', true, `K-FTS: ${kFts.cnt}, E-FTS: ${eFts.cnt}, S-FTS: ${sFts.cnt}`);
    } catch (e) {
        addCheck('fts5', 'Full-Text Search Virtual Tables', false, e.message);
    }

    // 4. Bi-Temporal Knowledge Graph & Append-Only Event Sourcing
    try {
        const entCount = db.get('SELECT COUNT(*) as cnt FROM entities').cnt;
        const relCount = db.get('SELECT COUNT(*) as cnt FROM entity_relations').cnt;
        const relEvents = db.get('SELECT COUNT(*) as cnt FROM entity_relation_events').cnt;
        addCheck('bitemporal', 'Bi-Temporal Graph & Append-Only Events', true, `Entities: ${entCount}, Active Relations: ${relCount}, Historical Events: ${relEvents}`);
    } catch (e) {
        addCheck('bitemporal', 'Bi-Temporal Graph Tables', false, e.message);
    }

    // 5. Memory Lifecycle & Provenance Audit Trail
    try {
        const memEvents = db.get('SELECT COUNT(*) as cnt FROM memory_events').cnt;
        const memProv = db.get('SELECT COUNT(*) as cnt FROM memory_provenance').cnt;
        addCheck('audit', 'Memory Lifecycle Events & Provenance', true, `Lifecycle Events: ${memEvents}, Provenance Records: ${memProv}`);
    } catch (e) {
        addCheck('audit', 'Memory Audit Tables', false, e.message);
    }

    // 6. Dense Embedding Subsystem
    try {
        const embHealth = await getEmbeddingHealth();
        const embOk = String(embHealth.status).toLowerCase() === 'ready';
        addCheck('embedding', '384-Dim Neural Vector Subsystem', embOk, `Status: ${embHealth.status} (${embHealth.mode})`);
    } catch (e) {
        addCheck('embedding', 'Embedding Subsystem', false, e.message);
    }

    // 7. Git Synchronization & Concurrency Lock
    const lockFile = path.join(brainDir, '.git-sync.lock');
    if (fs.existsSync(lockFile)) {
        try {
            const stats = fs.statSync(lockFile);
            const isStale = (Date.now() - stats.mtimeMs > 600000);
            if (isStale) {
                addWarning('git_lock', 'Detected stale .git-sync.lock file older than 10 minutes. Can be safely reclaimed.');
            } else {
                addCheck('git_lock', 'Git Concurrency Lock', true, 'Lock currently held by active synchronization process');
            }
        } catch (e) {}
    } else {
        addCheck('git_lock', 'Git Concurrency Mutual Exclusion', true, 'Lock clear (no contention)');
    }

    // Record metrics
    try {
        report.metrics = {
            profileAttributes: db.get('SELECT COUNT(*) as cnt FROM user_profile').cnt,
            knowledgeItems: db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt,
            solutions: db.get('SELECT COUNT(*) as cnt FROM solutions').cnt,
            conversations: db.get('SELECT COUNT(*) as cnt FROM conversations').cnt,
            episodes: db.get('SELECT COUNT(*) as cnt FROM episodes').cnt
        };
    } catch (e) {}

    report.summary = report.healthy ? 'All system diagnostics passed successfully. Engine is fully operational.' : 'Some diagnostic checks failed. Please review errors.';
    return report;
}

function formatDoctorReport(report) {
    const lines = [];
    lines.push('\n╔════════════════════════════════════════════════════════════════════════╗');
    lines.push('║             🩺 ANTIGRAVITY SECOND BRAIN — SYSTEM DOCTOR                ║');
    lines.push('╚════════════════════════════════════════════════════════════════════════╝\n');

    for (const c of report.checks) {
        const icon = c.passed ? '✔' : '✖';
        const color = c.passed ? '\x1b[32m' : '\x1b[31m';
        lines.push(`  ${color}${icon}\x1b[0m \x1b[1m[${c.category.toUpperCase()}]\x1b[0m ${c.name}: ${c.details}`);
    }

    if (report.warnings.length > 0) {
        lines.push('\n  ⚠️  \x1b[33mDIAGNOSTIC WARNINGS:\x1b[0m');
        for (const w of report.warnings) {
            lines.push(`    • [${w.category}] ${w.message}`);
        }
    }

    lines.push('\n────────────────────────────────────────────────────────────────────────');
    lines.push(`🏁 VERDICT: ${report.healthy ? '\x1b[32m✔ EXCELLENT HEALTH (Ready for Production)\x1b[0m' : '\x1b[31m✖ ISSUES DETECTED\x1b[0m'}`);
    lines.push('────────────────────────────────────────────────────────────────────────\n');

    return lines.join('\n');
}

module.exports = {
    runDiagnostics,
    formatDoctorReport
};
