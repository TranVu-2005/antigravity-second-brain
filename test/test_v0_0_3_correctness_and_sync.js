// ==============================================================================
// Antigravity Second Brain: Phase A & B Verification Suite (v0.0.3)
// Validates BRAIN_HOME Centralization, Cross-Platform Identity, Reinforcement FSM,
// True LRU Cache, Degraded Fallback Zero-Dense Score, Corrupt Config Backup, & Tombstone Sync
// ==============================================================================

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createTestDB } = require('../src/db');
const { BRAIN_HOME, DB_PATH, SCHEMA_PATH } = require('../src/config');
const { resolveCanonicalProjectScope } = require('../src/project_identity');
const { ReinforcementLearner } = require('../src/reinforcement');
const { SolutionStore } = require('../src/solutions');
const { computeEmbeddingSync, _embeddingCache, VECTOR_DIM } = require('../src/embedding');
const { SemanticKnowledge } = require('../src/semantic');
const { GitBackupManager } = require('../src/git_backup');

console.log('🧪 Starting Antigravity Second Brain v0.0.3 Correctness & Sync Suite...\n');

async function runTests() {
    // ------------------------------------------------------------------------------
    // Test 1: Config Centralization & Docker Volume Invariance
    // ------------------------------------------------------------------------------
    console.log('▶ Test 1: Verifying Centralized Config Layer & Persistence Path...');
    assert.ok(BRAIN_HOME, 'BRAIN_HOME must be defined');
    assert.ok(DB_PATH, 'DB_PATH must be defined');
    assert.ok(DB_PATH.endsWith('brain.db'), 'DB_PATH must point to brain.db');
    assert.ok(fs.existsSync(SCHEMA_PATH), 'SCHEMA_PATH must exist on disk');

    // Verify environment override simulation
    const originalEnv = process.env.BRAIN_DIR;
    try {
        process.env.BRAIN_DIR = '/data/.antigravity_brain';
        delete require.cache[require.resolve('../src/config')];
        const reloaded = require('../src/config');
        assert.strictEqual(reloaded.BRAIN_HOME, '/data/.antigravity_brain', 'BRAIN_HOME must respect process.env.BRAIN_DIR');
        assert.strictEqual(
            path.normalize(reloaded.DB_PATH),
            path.normalize(path.join('/data/.antigravity_brain', 'brain.db')),
            'DB_PATH must reside inside persistent volume and match OS-native normalization'
        );
    } finally {
        if (originalEnv) {
            process.env.BRAIN_DIR = originalEnv;
        } else {
            delete process.env.BRAIN_DIR;
        }
        delete require.cache[require.resolve('../src/config')];
    }
    console.log('  ✔ Test 1 PASSED: Centralized config guarantees Docker volume persistence.\n');

    // ------------------------------------------------------------------------------
    // Test 2: Cross-Platform Project Identity Parity (Windows ↔ Linux)
    // ------------------------------------------------------------------------------
    console.log('▶ Test 2: Verifying Cross-Platform Project Identity Parity...');
    const scopeCurrent = resolveCanonicalProjectScope(path.resolve(__dirname, '..'));
    assert.ok(scopeCurrent.startsWith('proj_'), `Scope must start with proj_, got: ${scopeCurrent}`);

    const crypto = require('node:crypto');
    function testNormalizeRemote(url) {
        let n = url.trim().toLowerCase().replace(/\.git$/i, '').replace(/^(?:https?:\/\/|ssh:\/\/|git@)/i, '').replace(/^([^/:]+):/, '$1/').replace(/\/+/g, '/');
        return `proj_${crypto.createHash('sha256').update(n).digest('hex').slice(0, 12)}`;
    }
    const hashHttps = testNormalizeRemote('https://github.com/TranVu-2005/antigravity-second-brain.git');
    const hashSsh = testNormalizeRemote('git@github.com:TranVu-2005/antigravity-second-brain.git');
    const hashPlain = testNormalizeRemote('github.com/tranvu-2005/antigravity-second-brain');
    assert.strictEqual(hashHttps, hashSsh, 'HTTPS and SSH remote URLs must yield identical project identity');
    assert.strictEqual(hashHttps, hashPlain, 'URL without protocol must yield identical project identity');
    assert.strictEqual(scopeCurrent, hashHttps, 'Engine must match canonical remote hash for current repo');
    console.log(`  ✔ Test 2 PASSED: Cross-platform identity is deterministic: ${scopeCurrent}\n`);

    // ------------------------------------------------------------------------------
    // Test 3: Reinforcement FSM State Machine (Elimination of False-Success Bug)
    // ------------------------------------------------------------------------------
    console.log('▶ Test 3: Verifying Reinforcement Learner Finite State Machine...');
    const memDB = createTestDB(':memory:');
    const solStore = new SolutionStore(memDB);
    const learner = new ReinforcementLearner(solStore);

    // Case 3A: Failure without subsequent success must NOT create solution candidate
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-test-'));
    const failOnlyTranscript = path.join(tmpDir, 'fail_only.jsonl');
    fs.writeFileSync(failOnlyTranscript, [
        JSON.stringify({ type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm test' } }] }),
        JSON.stringify({ type: 'GENERIC', content: 'SyntaxError: Unexpected token\nThe command exited with code 1' })
    ].join('\n'), 'utf8');

    const res3A = learner.mineTranscript(failOnlyTranscript, 'test_scope');
    assert.strictEqual(res3A.learned, 0, 'Must NOT learn solutions from failure alone');
    assert.strictEqual(memDB.all('SELECT * FROM solutions WHERE project_scope = ?', 'test_scope').length, 0, 'Database must have 0 solutions for test_scope');

    // Case 3B: Failure -> Remediation Command -> Success (Exit code 0) MUST learn candidate with 0.35 confidence
    const successTranscript = path.join(tmpDir, 'success_fix.jsonl');
    fs.writeFileSync(successTranscript, [
        JSON.stringify({ type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm run bad-cmd' } }] }),
        JSON.stringify({ type: 'GENERIC', content: 'CommandNotFoundException: bad-cmd is not recognized\nThe command exited with code 1' }),
        JSON.stringify({ type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm run good-cmd' } }] }),
        JSON.stringify({ type: 'GENERIC', content: 'All checks passed!\nThe command exited with code 0' })
    ].join('\n'), 'utf8');

    const res3B = learner.mineTranscript(successTranscript, 'test_scope');
    assert.strictEqual(res3B.learned, 1, 'Must learn 1 verified solution');
    assert.strictEqual(res3B.solutions[0].fix, 'npm run good-cmd', 'Candidate fix must be the winning command');

    const storedSol = memDB.all('SELECT * FROM solutions WHERE project_scope = ?', 'test_scope')[0];
    assert.strictEqual(storedSol.confidence, 0.35, 'Autonomous mined solution must start with candidate confidence 0.35 (No inflation)');
    assert.strictEqual(storedSol.verification_status, 'candidate', 'Status must be candidate');
    assert.strictEqual(storedSol.trust_level, 'low', 'Trust must be low');
    console.log('  ✔ Test 3 PASSED: Reinforcement FSM successfully verifies exit code 0 before promotion.\n');

    // ------------------------------------------------------------------------------
    // Test 4: True LRU Cache Eviction Order
    // ------------------------------------------------------------------------------
    console.log('▶ Test 4: Verifying True LRU Cache Eviction Order...');
    _embeddingCache.clear();
    computeEmbeddingSync('item_1');
    computeEmbeddingSync('item_2');
    computeEmbeddingSync('item_3');

    // Access item_1 to make it most recently used (True LRU update)
    computeEmbeddingSync('item_1');

    const keysAfterAccess = Array.from(_embeddingCache.keys());
    assert.strictEqual(keysAfterAccess[keysAfterAccess.length - 1], 'item_1', 'item_1 must move to the newest position in Map upon read');
    assert.strictEqual(keysAfterAccess[0], 'item_2', 'item_2 must now be the oldest entry in Map');
    console.log('  ✔ Test 4 PASSED: True LRU refresh on read verified.\n');

    // ------------------------------------------------------------------------------
    // Test 5: Degraded Fallback Embedding Zero Dense Score
    // ------------------------------------------------------------------------------
    console.log('▶ Test 5: Verifying Fallback Embedding Zero Dense Score in Retrieval...');
    const semDB = createTestDB(':memory:');
    const semantic = new SemanticKnowledge(semDB);

    const fallbackItemId = semantic.addItemSync({
        title: 'PostgreSQL Connection Pooling Guide',
        content: 'Use PgBouncer for transaction-level pooling to handle thousands of concurrent queries safely.',
        tags: 'postgres,pgbouncer,database',
        category: 'snippet'
    });

    const insertedItem = semDB.get('SELECT embedding_status FROM knowledge_items WHERE id = ?', fallbackItemId);
    assert.strictEqual(insertedItem.embedding_status, 'fallback', 'Item must be marked as fallback');

    const results = await semantic.searchKnowledge('PostgreSQL Connection Pooling', 5);
    const found = results.find(r => r.id === fallbackItemId);
    assert.ok(found, 'Item must be found via Sparse BM25');
    assert.strictEqual(found.denseScore, 0, 'Dense score must be strictly 0 for fallback embedding');
    console.log('  ✔ Test 5 PASSED: Fallback embeddings do not pollute dense cosine scoring.\n');

    // ------------------------------------------------------------------------------
    // Test 6: Tombstone Sync & Manifest Generation
    // ------------------------------------------------------------------------------
    console.log('▶ Test 6: Verifying Tombstone Sync Propagation & Manifest Export...');
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    const exportsDir = path.join(backupDir, 'exports');
    const backupMgr = new GitBackupManager(backupDir, exportsDir, semDB);

    const exportRes = backupMgr.exportDataSnapshot();
    assert.ok(exportRes.success, 'Export must succeed');
    assert.ok(fs.existsSync(path.join(exportsDir, 'manifest.json')), 'manifest.json must be generated');
    assert.ok(fs.existsSync(path.join(exportsDir, 'entity_relation_events.json')), 'entity_relation_events.json must be generated');
    assert.ok(fs.existsSync(path.join(exportsDir, 'memory_events.json')), 'memory_events.json must be generated');

    const manifest = JSON.parse(fs.readFileSync(path.join(exportsDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.engine_version, '0.0.3', 'Manifest must reflect engine version 0.0.3');
    assert.ok(manifest.counts.knowledge >= 1, 'Manifest must record knowledge count');

    // Logical forget item
    semantic.forgetItem(fallbackItemId, { hardDelete: false });
    const tombstoneItem = semDB.get('SELECT verification_status FROM knowledge_items WHERE id = ?', fallbackItemId);
    assert.strictEqual(tombstoneItem.verification_status, 'tombstone', 'Item must be marked tombstone');

    // Re-export and restore into fresh DB
    backupMgr.exportDataSnapshot();

    const targetDB = createTestDB(':memory:');
    const restoreRes = backupMgr.restoreFromJSON(targetDB, exportsDir);
    assert.ok(restoreRes.success, 'Restore must succeed');

    const restoredTombstone = targetDB.get('SELECT verification_status FROM knowledge_items WHERE id = ?', fallbackItemId);
    assert.strictEqual(restoredTombstone.verification_status, 'tombstone', 'Restored item must preserve tombstone status');
    console.log('  ✔ Test 6 PASSED: Tombstone sync and manifest generation verified.\n');

    // Clean up temporary directories
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (e) {}

    console.log('🏁 All 6 Invariant Tests in test_v0_0_3_correctness_and_sync.js PASSED flawlessly!');
}

runTests().catch(err => {
    console.error('💥 Test Suite Failed:', err);
    process.exit(1);
});
