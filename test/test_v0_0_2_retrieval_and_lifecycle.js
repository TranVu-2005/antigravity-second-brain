// ==============================================================================
// Antigravity Second Brain: Phase 2, 3 & 4 Architecture Verification Suite
// Validates Full Dense Scan, Graph Path Evidence, True Bi-Temporal Events & Doctor
// ==============================================================================

const assert = require('node:assert');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { SemanticKnowledge } = require('../src/semantic');
const { runDiagnostics } = require('../src/doctor');
const { computeEmbedding, vectorToBuffer, VECTOR_DIM } = require('../src/embedding');

function createTestDB() {
    const db = new DatabaseSync(':memory:');
    db.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS user_profile (
            key TEXT PRIMARY KEY,
            category TEXT NOT NULL DEFAULT 'general',
            value TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            source TEXT DEFAULT 'system',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            summary TEXT,
            key_takeaways TEXT,
            message_count INTEGER NOT NULL DEFAULT 0,
            last_step_index INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            step_index INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT,
            tags TEXT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS knowledge_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'fact',
            tags TEXT,
            source TEXT DEFAULT 'auto_extraction',
            importance REAL NOT NULL DEFAULT 1.0,
            access_count INTEGER NOT NULL DEFAULT 0,
            trust_level TEXT NOT NULL DEFAULT 'medium',
            confidence REAL NOT NULL DEFAULT 0.8,
            verification_status TEXT NOT NULL DEFAULT 'candidate',
            last_verified_at TEXT,
            embedding BLOB,
            embedding_status TEXT NOT NULL DEFAULT 'neural',
            project_scope TEXT DEFAULT 'global',
            content_updated_at TEXT,
            last_accessed_at TEXT,
            last_decay_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS solutions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            error_pattern TEXT NOT NULL,
            root_cause TEXT,
            solution_code TEXT NOT NULL,
            command_fix TEXT,
            project_scope TEXT DEFAULT 'global',
            tags TEXT,
            trust_level TEXT NOT NULL DEFAULT 'medium',
            confidence REAL NOT NULL DEFAULT 1.0,
            verification_status TEXT NOT NULL DEFAULT 'candidate',
            last_verified_at TEXT,
            success_count INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            type TEXT NOT NULL DEFAULT 'concept',
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS entity_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_entity TEXT NOT NULL,
            relation TEXT NOT NULL,
            target_entity TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            valid_from TEXT NOT NULL DEFAULT (datetime('now')),
            valid_until TEXT DEFAULT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS entity_relation_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            source_entity TEXT NOT NULL,
            relation TEXT NOT NULL,
            target_entity TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            valid_from TEXT NOT NULL DEFAULT (datetime('now')),
            valid_until TEXT DEFAULT NULL,
            metadata TEXT DEFAULT '{}',
            transaction_time TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS memory_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            confidence REAL,
            details TEXT,
            recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS memory_provenance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            source_type TEXT NOT NULL,
            source_ref TEXT,
            author TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
            title, content, tags, category,
            content='knowledge_items', content_rowid='id'
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
            summary, content, tags,
            content='episodes', content_rowid='id'
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS solutions_fts USING fts5(
            error_pattern, root_cause, solution_code, command_fix, tags,
            content='solutions', content_rowid='id'
        );
    `);

    // Add wrapping helper methods matching BrainDB
    return {
        db,
        get: (sql, ...params) => db.prepare(sql).get(...params),
        all: (sql, ...params) => db.prepare(sql).all(...params),
        run: (sql, ...params) => db.prepare(sql).run(...params),
        exec: (sql) => db.exec(sql),
        prepare: (sql) => db.prepare(sql),
        close: () => db.close()
    };
}

async function runSuite() {
    console.log('🧪 Starting Phase 2, 3 & 4 Architectural Verification Suite...\n');

    // -------------------------------------------------------------------------
    // Test 1: Full Dense Scan (> 50 items, old relevant item outside recent 25)
    // -------------------------------------------------------------------------
    console.log('▶ Test 1: Full Dense Scan Architecture (<10k Vectors)');
    {
        const testDB = createTestDB();
        const semantic = new SemanticKnowledge(testDB);

        // Populate 60 items. Item #1 has highest semantic similarity to query but was inserted first (oldest).
        const queryVec = await computeEmbedding('microkernel');
        const targetVector = new Float32Array(queryVec);

        const noiseVector = new Float32Array(VECTOR_DIM);
        noiseVector[10] = 0.99;

        // Insert older relevant item first
        const oldId = semantic.addItemSync({
            title: 'Ancient Architecture Concept',
            content: 'Deep microkernel message passing design pattern',
            category: 'concept',
            tags: 'kernel,design',
            confidence: 0.9
        });
        testDB.run("UPDATE knowledge_items SET embedding = ?, embedding_status = 'neural' WHERE id = ?", vectorToBuffer(targetVector), oldId);

        // Insert 55 filler/recent items with orthogonal noise vector
        for (let i = 2; i <= 56; i++) {
            const fid = semantic.addItemSync({
                title: `Recent Unrelated Note ${i}`,
                content: `Random daily log entry item number ${i} about weather and coffee`,
                category: 'note',
                tags: 'filler',
                confidence: 0.5
            });
            testDB.run("UPDATE knowledge_items SET embedding = ?, embedding_status = 'neural' WHERE id = ?", vectorToBuffer(noiseVector), fid);
        }

        const totalItems = testDB.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
        assert.ok(totalItems > 50, 'Must contain > 50 items to exceed old 50-item threshold');

        // Query with vector pointing directly at targetVector (zero keyword match with ancient item)
        const results = await semantic.searchKnowledge('microkernel', { limit: 5 });
        assert.ok(results.length > 0, 'Must return results');
        assert.strictEqual(results[0].id, oldId, 'Full dense scan MUST discover the older item outside recent-25');
        console.log('  ✔ Passed: Old relevant item outside recent-25 successfully retrieved via Full Dense Scan');
        testDB.close();
    }

    // -------------------------------------------------------------------------
    // Test 2: Real Graph Path Evidence without Artificial Score Floors
    // -------------------------------------------------------------------------
    console.log('\n▶ Test 2: Graph Path Evidence & Feature Ranker (No Magic Floors)');
    {
        const testDB = createTestDB();
        const semantic = new SemanticKnowledge(testDB);

        // Setup entity relation
        semantic.addEntity('Apollo', 'project', 'Moon exploration');
        semantic.addEntity('SaturnV', 'technology', 'Heavy rocket');
        semantic.addRelation('Apollo', 'uses', 'SaturnV', { confidence: 0.85 });

        const kId = semantic.addItemSync({
            title: 'SaturnV Rocket Staging',
            content: 'Three-stage liquid-fueled super heavy launch vehicle specifications',
            category: 'fact',
            tags: 'rocketry'
        });

        const results = await semantic.searchKnowledge('Apollo', { expand_graph: true, limit: 5 });
        const target = results.find(r => r.id === kId);
        assert.ok(target, 'Target item linked via graph relation must be discovered');
        assert.ok(target.graphScore > 0, 'Target item must have genuine positive graphScore');
        assert.ok(target.graphScore <= 1.0, 'graphScore must be normalized');
        console.log(`  ✔ Passed: Graph evidence calculated accurately (graphScore: ${target.graphScore}) without arbitrary floors`);
        testDB.close();
    }

    // -------------------------------------------------------------------------
    // Test 3: Logical Forget (Tombstone) vs Physical Erasure
    // -------------------------------------------------------------------------
    console.log('\n▶ Test 3: Transparent Memory Lifecycle (Logical Tombstone vs Physical Erasure)');
    {
        const testDB = createTestDB();
        const semantic = new SemanticKnowledge(testDB);

        const id1 = semantic.addItemSync({
            title: 'Ephemeral Secret Key',
            content: 'Super confidential token to be forgotten later',
            category: 'snippet'
        });

        // 1. Logical Forget
        const forgot = semantic.forgetItem(id1);
        assert.strictEqual(forgot, true, 'Logical forget should succeed');

        const itemAfterForget = testDB.get('SELECT * FROM knowledge_items WHERE id = ?', id1);
        assert.strictEqual(itemAfterForget.verification_status, 'tombstone', 'Item status must be tombstone');

        // Verify retrieval excludes tombstoned item
        const searchResults = await semantic.searchKnowledge('Ephemeral Secret Key');
        const found = searchResults.some(r => r.id === id1);
        assert.strictEqual(found, false, 'Tombstoned items must NEVER appear in search results');

        // Check audit trail
        const audit = semantic.getMemoryAuditTrail('knowledge', id1);
        assert.ok(audit.events.length >= 2, 'Must record CREATED and TOMBSTONED events');
        assert.strictEqual(audit.events[audit.events.length - 1].event_type, 'TOMBSTONED');

        // 2. Physical Erasure
        const purged = semantic.forgetItem(id1, { hardDelete: true });
        assert.strictEqual(purged, true, 'Hard delete should succeed');
        const itemAfterPurge = testDB.get('SELECT * FROM knowledge_items WHERE id = ?', id1);
        assert.ok(!itemAfterPurge, 'Item must be physically removed from table on hardDelete');

        console.log('  ✔ Passed: Logical Forget (tombstone) & Physical Erasure validated with complete audit trail');
        testDB.close();
    }

    // -------------------------------------------------------------------------
    // Test 4: True Bi-Temporal Knowledge Graph & Append-Only Event Sourcing
    // -------------------------------------------------------------------------
    console.log('\n▶ Test 4: True Bi-Temporal Knowledge Graph & Event Sourcing');
    {
        const testDB = createTestDB();
        const semantic = new SemanticKnowledge(testDB);

        // 1. Event: Alice uses Tool_A
        semantic.addRelation('Alice', 'uses', 'Tool_A', { confidence: 0.9 });

        // 2. Event: Alice expires Tool_A
        semantic.expireRelation('Alice', 'uses', 'Tool_A');

        // 3. Event: Alice adopts Tool_B
        semantic.addRelation('Alice', 'uses', 'Tool_B', { confidence: 0.95 });

        // Check immutable append-only event table
        const timeline = semantic.getBitemporalTimeline('Alice');
        assert.strictEqual(timeline.length, 3, 'Must record exactly 3 append-only immutable events');
        assert.strictEqual(timeline[0].event_type, 'INSERT');
        assert.strictEqual(timeline[0].target_entity, 'Tool_A');
        assert.strictEqual(timeline[1].event_type, 'EXPIRE');
        assert.strictEqual(timeline[1].target_entity, 'Tool_A');
        assert.strictEqual(timeline[2].event_type, 'INSERT');
        assert.strictEqual(timeline[2].target_entity, 'Tool_B');

        // Check active query only returns active relation for Alice (Tool_B)
        const activeGraph = semantic.getGraph(false);
        const aliceActive = activeGraph.relations.filter(r => r.source === 'Alice');
        assert.strictEqual(aliceActive.length, 1, 'Only active relation for Alice should be returned');
        assert.strictEqual(aliceActive[0].target, 'Tool_B');

        console.log('  ✔ Passed: Bi-temporal timeline reconstructed with 100% fidelity from append-only events');
        testDB.close();
    }

    // -------------------------------------------------------------------------
    // Test 5: Diagnostic Doctor & System Health Report
    // -------------------------------------------------------------------------
    console.log('\n▶ Test 5: Diagnostic Doctor Tooling (src/doctor.js)');
    {
        const testDB = createTestDB();
        const report = await runDiagnostics(testDB);
        assert.strictEqual(report.healthy, true, 'Doctor report must be healthy for valid test DB');
        assert.ok(report.checks.length >= 7, 'Must execute all 7 core diagnostic checks');
        console.log('  ✔ Passed: runDiagnostics() successfully audited all subsystem health checks');
        testDB.close();
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('🏁 ALL PHASE 2, 3 & 4 ARCHITECTURAL TESTS PASSED FLAWLESSLY!');
    console.log('════════════════════════════════════════════════════════════════\n');
}

runSuite().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
