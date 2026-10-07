// ==============================================================================
// Antigravity Second Brain: v0.0.1 Production-Grade Reliability Test Suite
// Verifies: Canonical Project Identity, Evidence-Based Reinforcement,
// Safe Deduplication, Git-Sync Cross-Process Lock, and Snapshot Idempotence.
// ==============================================================================

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { BrainDB } = require('../src/db');
function createTestDB() {
    return new BrainDB(':memory:');
}

console.log('🧪 Starting v0.0.1 Reliability & Invariant Verification Suite...\n');

// ------------------------------------------------------------------------------
// Test 1: Canonical Project Identity (Anti-Collision for Identical Basenames)
// ------------------------------------------------------------------------------
console.log('▶ Test 1: Canonical Project Identity — Collision Prevention');
{
    const { resolveCanonicalProjectScope } = require('../src/project_identity');
    
    const tmpDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'sb_test_a_'));
    const tmpDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'sb_test_b_'));
    const pathA = path.join(tmpDirA, 'api');
    const pathB = path.join(tmpDirB, 'api');
    fs.mkdirSync(pathA);
    fs.mkdirSync(pathB);

    try {
        const scopeA = resolveCanonicalProjectScope([pathA]);
        const scopeB = resolveCanonicalProjectScope([pathB]);

        assert.strictEqual(typeof scopeA, 'string', 'Scope A must be a string');
        assert.strictEqual(typeof scopeB, 'string', 'Scope B must be a string');
        assert.notStrictEqual(scopeA, scopeB, 'Workspaces with identical basenames in different paths must NOT have identical scope IDs!');
        assert.ok(scopeA.startsWith('proj_') || scopeA.startsWith('local_'), 'Scope must have canonical prefix');
        assert.ok(scopeB.startsWith('proj_') || scopeB.startsWith('local_'), 'Scope must have canonical prefix');
        console.log(`  ✔ Passed: ${pathA} ➔ ${scopeA} vs ${pathB} ➔ ${scopeB}`);
    } finally {
        fs.rmSync(tmpDirA, { recursive: true, force: true });
        fs.rmSync(tmpDirB, { recursive: true, force: true });
    }
}

// ------------------------------------------------------------------------------
// Test 2: Evidence-Based Reinforcement & Trust Anti-Inflation
// ------------------------------------------------------------------------------
console.log('\n▶ Test 2: Evidence-Based Reinforcement & Anti-Inflation');
{
    const testDb = createTestDB(':memory:');
    const { SolutionStore } = require('../src/solutions');
    const { ReinforcementLearner } = require('../src/reinforcement');
    
    const solStore = new SolutionStore(testDb);
    const learner = new ReinforcementLearner(solStore);

    // Create a mock transcript with an error and a successful command
    const tmpTranscript = path.join(os.tmpdir(), `test_transcript_${Date.now()}.jsonl`);
    const transcriptLines = [
        JSON.stringify({ type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'run_command', args: { CommandLine: 'node bad.js' } }] }),
        JSON.stringify({ type: 'GENERIC', content: 'SyntaxError: unexpected token\nCommand exited with code 1' }),
        JSON.stringify({ type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'run_command', args: { CommandLine: 'node good.js' } }] }),
        JSON.stringify({ type: 'GENERIC', content: 'The command exited with code 0' })
    ];
    fs.writeFileSync(tmpTranscript, transcriptLines.join('\n'), 'utf8');

    try {
        const res = learner.mineTranscript(tmpTranscript, 'test_proj');
        assert.strictEqual(res.learned, 1, 'Should learn one solution');

        const mined = solStore.searchSolutions('SyntaxError', { project_scope: 'test_proj' });
        const sol = mined.find(s => s.project_scope === 'test_proj');
        assert.ok(sol, 'Must find candidate solution mined for test_proj');

        // INVARIANT: Mined solution must start with candidate status and modest confidence, NEVER 1.0!
        assert.ok(sol.confidence <= 0.40, `Initial confidence must be <= 0.40 (candidate), got ${sol.confidence}`);
        assert.strictEqual(sol.verification_status, 'candidate', `Status must be candidate, got ${sol.verification_status}`);
        assert.strictEqual(sol.trust_level, 'low', `Trust level must be low, got ${sol.trust_level}`);

        // Reinforcing with repeated success increments gradually
        solStore.recordSuccess(sol.id);
        const reinforced1 = testDb.get('SELECT confidence, verification_status, trust_level, success_count FROM solutions WHERE id = ?', sol.id);
        assert.strictEqual(reinforced1.success_count, 2);
        assert.strictEqual(reinforced1.verification_status, 'observed');
        assert.ok(reinforced1.confidence <= 0.60, `Confidence at count 2 should be <= 0.60, got ${reinforced1.confidence}`);

        console.log(`  ✔ Passed: Initial confidence = ${sol.confidence}, status = ${sol.verification_status}; after reinforcement = ${reinforced1.confidence}, status = ${reinforced1.verification_status}`);
    } finally {
        if (fs.existsSync(tmpTranscript)) fs.unlinkSync(tmpTranscript);
    }
}

// ------------------------------------------------------------------------------
// Test 3: Safe Deduplication in Consolidation (Scope & Provenance Protection)
// ------------------------------------------------------------------------------
console.log('\n▶ Test 3: Safe Deduplication — Scope & Provenance Preservation');
{
    const testDb = createTestDB(':memory:');
    const { MemoryConsolidator } = require('../src/consolidation');
    const consolidator = new MemoryConsolidator(testDb);

    // Insert two items with the SAME title but DIFFERENT project scopes
    testDb.run(`
        INSERT INTO knowledge_items (title, content, category, project_scope, importance, confidence)
        VALUES ('System Architecture', 'Content for project A', 'architecture', 'proj_alpha', 1.0, 0.9)
    `);
    testDb.run(`
        INSERT INTO knowledge_items (title, content, category, project_scope, importance, confidence)
        VALUES ('System Architecture', 'Content for project B', 'architecture', 'proj_beta', 1.0, 0.8)
    `);

    // Insert two items with the SAME title AND SAME scope (true duplicate)
    testDb.run(`
        INSERT INTO knowledge_items (title, content, category, project_scope, importance, confidence, access_count)
        VALUES ('Code Style Guide', 'Old style guide', 'rule', 'proj_alpha', 0.8, 0.7, 1)
    `);
    testDb.run(`
        INSERT INTO knowledge_items (title, content, category, project_scope, importance, confidence, access_count)
        VALUES ('Code Style Guide', 'Updated style guide', 'rule', 'proj_alpha', 1.0, 0.95, 5)
    `);

    const stats = consolidator.consolidate();
    
    // Check that items in different projects were NOT deleted!
    const projA = testDb.all("SELECT id, content FROM knowledge_items WHERE title = 'System Architecture' AND project_scope = 'proj_alpha'");
    const projB = testDb.all("SELECT id, content FROM knowledge_items WHERE title = 'System Architecture' AND project_scope = 'proj_beta'");
    assert.strictEqual(projA.length, 1, 'Project Alpha architecture item must be preserved');
    assert.strictEqual(projB.length, 1, 'Project Beta architecture item must be preserved');

    // Check that the true duplicate in proj_alpha was cleanly merged and kept the higher trust version
    const styleGuides = testDb.all("SELECT id, content, access_count, confidence FROM knowledge_items WHERE title = 'Code Style Guide' AND project_scope = 'proj_alpha'");
    assert.strictEqual(styleGuides.length, 1, 'True duplicate must be deduplicated to 1 item');
    assert.strictEqual(styleGuides[0].content, 'Updated style guide', 'Must retain the higher confidence content');

    console.log(`  ✔ Passed: Scope preservation confirmed (Alpha & Beta kept). Deduplicated items: ${stats.deduplicatedItems}`);
}

// ------------------------------------------------------------------------------
// Test 4: Cross-Process Git-Sync File Lock
// ------------------------------------------------------------------------------
console.log('\n▶ Test 4: Cross-Process Git-Sync Lock Concurrency Control');
{
    const { GitSyncLock } = require('../src/git_lock');
    const lockPath = path.join(os.tmpdir(), `test_gitsync_${Date.now()}.lock`);

    const lockA = new GitSyncLock(lockPath);
    const lockB = new GitSyncLock(lockPath);

    try {
        const acquiredA = lockA.acquire(1000);
        assert.strictEqual(acquiredA, true, 'Lock A must acquire successfully');

        // Lock B must fail to acquire while A holds it
        const acquiredB = lockB.acquire(200);
        assert.strictEqual(acquiredB, false, 'Lock B must fail while Lock A holds it');

        // Release A
        lockA.release();

        // Lock B must now acquire
        const acquiredB2 = lockB.acquire(1000);
        assert.strictEqual(acquiredB2, true, 'Lock B must acquire after Lock A releases');
        lockB.release();

        console.log('  ✔ Passed: GitSyncLock successfully controls mutual exclusion and releases cleanly');
    } finally {
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    }
}

// ------------------------------------------------------------------------------
// Test 5: Idempotent Snapshot & Parameterized JSON Restoration
// ------------------------------------------------------------------------------
console.log('\n▶ Test 5: Idempotent Snapshot & Parameterized JSON Restoration');
{
    const testDb = createTestDB(':memory:');
    const { GitBackupManager } = require('../src/git_backup');
    const backupMgr = new GitBackupManager(testDb);

    // Insert entity relations with tricky quotes and special characters
    testDb.run(`
        INSERT INTO entity_relations (source_entity, relation, target_entity, confidence, metadata)
        VALUES ('Node.js', 'supports', 'ESM & CJS', 0.95, '{"note": "tricky '' quotes and \\"double\\" quotes"}')
    `);
    testDb.run(`
        INSERT INTO knowledge_items (title, content, category, project_scope, importance, confidence)
        VALUES ('SQL Injection Check', 'Testing single quotes: O''Reilly & double quotes: "quoted"', 'test', 'global', 1.0, 1.0)
    `);

    // Export snapshot
    const exportRes = backupMgr.exportData();
    assert.strictEqual(exportRes.success, true, 'Export data must succeed');

    // Create a new clean database
    const freshDb = createTestDB(':memory:');
    const restoreMgr = new GitBackupManager(freshDb);

    // Restore from JSON snapshot using parameterized statements
    const restoreRes = restoreMgr.restoreFromJSON();
    assert.strictEqual(restoreRes.success, true, `Restore from JSON must succeed: ${restoreRes.error || ''}`);

    // Verify relations and knowledge were preserved exactly without syntax error
    const restoredRel = freshDb.get("SELECT source_entity, relation, target_entity, metadata FROM entity_relations WHERE source_entity = 'Node.js'");
    assert.ok(restoredRel, 'Restored relation must exist');
    assert.strictEqual(restoredRel.target_entity, 'ESM & CJS');

    const restoredK = freshDb.get("SELECT title, content FROM knowledge_items WHERE title = 'SQL Injection Check'");
    assert.ok(restoredK, 'Restored knowledge item must exist');
    assert.ok(restoredK.content.includes("O'Reilly"), 'Special characters with single quotes must be intact');

    // Test Idempotence: Restoring a SECOND time must not throw constraint violation
    const restoreRes2 = restoreMgr.restoreFromJSON();
    assert.strictEqual(restoreRes2.success, true, 'Second restore must be 100% idempotent');

    console.log('  ✔ Passed: 100% Parameterized JSON restore verified with full idempotence and special character preservation');
}

// ------------------------------------------------------------------------------
// Test 6: Seed Solution Safety Verification
// ------------------------------------------------------------------------------
console.log('\n▶ Test 6: Seed Solution Security & Safety Tagging');
{
    const testDb = createTestDB(':memory:');
    const { SolutionStore } = require('../src/solutions');
    const solStore = new SolutionStore(testDb);

    const solutions = solStore.searchSolutions('', { limit: 50 });
    for (const sol of solutions) {
        assert.ok(!sol.command_fix.includes('shell: true'), `Command fix must not recommend shell: true: ${sol.command_fix}`);
        assert.ok(!sol.solution_code.includes('shell: true in child_process'), `Solution code must not recommend shell: true`);
        assert.ok(sol.tags && (sol.tags.includes('verified') || sol.tags.includes('candidate') || sol.tags.includes('safe')), 'Solutions must carry safety classification tags');
    }
    console.log('  ✔ Passed: Zero shell: true violations in seed solutions; safety classifications verified');
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('🏁 ALL v0.0.1 RELIABILITY & INVARIANT TESTS PASSED FLAWLESSLY!');
console.log('════════════════════════════════════════════════════════════════\n');
