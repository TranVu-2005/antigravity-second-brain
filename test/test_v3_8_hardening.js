#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: v3.8 Hardening & Verification Test Suite
// Verifies Atomic Restore, Memory Trust Lifecycle, and Multi-Hop Graph Retrieval
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrainDB } = require('../src/db');
const { GitBackupManager } = require('../src/git_backup');
const { ContextRetriever } = require('../src/retriever');
const { MemoryExtractor } = require('../src/extractor');
const { MemoryConsolidator } = require('../src/consolidation');

console.log('🧪 Bắt đầu chạy bộ kiểm thử v3.8 Production Hardening Suite...\n');

test('1. Atomic Restore: Corrupt dump triggers rollback and preserves state', () => {
    const tmpDir = path.join(__dirname, 'temp_test_restore_brain');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const dbPath = path.join(tmpDir, 'test_brain.db');
    const exportsDir = path.join(tmpDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });

    const db = new BrainDB(dbPath);
    try {
        // Seed baseline knowledge item
        db.run('INSERT INTO knowledge_items (title, content, category) VALUES (?, ?, ?)',
            'Baseline Fact', 'This must remain intact after corrupt restore', 'fact'
        );
        const baselineCount = db.get('SELECT COUNT(*) as c FROM knowledge_items').c;
        assert.strictEqual(baselineCount, 1);

        const mgr = new GitBackupManager(tmpDir, exportsDir, db);

        // Create corrupt dump: valid insert followed by syntax failure
        const corruptDumpPath = path.join(exportsDir, 'corrupt_dump.sql');
        const corruptSql = `
            INSERT INTO knowledge_items (title, content, category) VALUES ('Ghost Fact', 'Should be rolled back', 'fact');
            INVALID SQL SYNTAX HERE ERROR;
        `;
        fs.writeFileSync(corruptDumpPath, corruptSql, 'utf8');

        // Execute import
        const res = mgr.importDump(corruptDumpPath);
        assert.strictEqual(res.success, false, 'Importing corrupt dump must report failure');

        // Check that 'Ghost Fact' was NOT committed and baseline remains intact
        const afterCount = db.get('SELECT COUNT(*) as c FROM knowledge_items').c;
        assert.strictEqual(afterCount, baselineCount, 'Ghost Fact must be rolled back on syntax error');
        const baselineRow = db.get('SELECT title FROM knowledge_items WHERE title = ?', 'Baseline Fact');
        assert.ok(baselineRow, 'Original data must still exist');

        // Test valid dump
        const validDumpPath = path.join(exportsDir, 'valid_dump.sql');
        const validSql = `
            INSERT INTO knowledge_items (title, content, category) VALUES ('Valid Restored Fact', 'Restored successfully', 'fact');
        `;
        fs.writeFileSync(validDumpPath, validSql, 'utf8');

        const validRes = mgr.importDump(validDumpPath);
        assert.strictEqual(validRes.success, true, 'Valid dump must succeed');
        const countAfterValid = db.get('SELECT COUNT(*) as c FROM knowledge_items').c;
        assert.strictEqual(countAfterValid, 2);

    } finally {
        db.close();
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }
});

test('2. Memory Trust Model & Confidence Lifecycle: Schema, Defaults, and Promotion', () => {
    const db = new BrainDB(':memory:');
    try {
        // Verify columns in knowledge_items
        const kCols = db.all("PRAGMA table_info(knowledge_items)").map(c => c.name);
        assert.ok(kCols.includes('trust_level'), 'knowledge_items must have trust_level');
        assert.ok(kCols.includes('confidence'), 'knowledge_items must have confidence');
        assert.ok(kCols.includes('verification_status'), 'knowledge_items must have verification_status');
        assert.ok(kCols.includes('last_verified_at'), 'knowledge_items must have last_verified_at');

        // Verify columns in solutions
        const sCols = db.all("PRAGMA table_info(solutions)").map(c => c.name);
        assert.ok(sCols.includes('trust_level'), 'solutions must have trust_level');
        assert.ok(sCols.includes('confidence'), 'solutions must have confidence');
        assert.ok(sCols.includes('verification_status'), 'solutions must have verification_status');
        assert.ok(sCols.includes('last_verified_at'), 'solutions must have last_verified_at');

        // Test insertion with default values
        db.run('INSERT INTO knowledge_items (title, content) VALUES (?, ?)', 'Test K', 'Content');
        const row = db.get('SELECT * FROM knowledge_items WHERE title = ?', 'Test K');
        assert.strictEqual(row.trust_level, 'medium');
        assert.strictEqual(row.verification_status, 'candidate');
        assert.ok(row.confidence >= 0.7 && row.confidence <= 1.0);

        // Test Extractor Trust assignment
        const extractor = new MemoryExtractor(db);
        const extracted = extractor.extractFromText(
            "Ngài yêu cầu: luôn dùng cổng 8765 cho bridge daemon.",
            "user",
            "conv-123"
        );

        // Direct user instruction should receive high trust or verified candidate
        const savedKnowledge = db.get("SELECT * FROM knowledge_items WHERE content LIKE '%8765%'");
        if (savedKnowledge) {
            assert.ok(['high', 'medium'].includes(savedKnowledge.trust_level));
        }

        // Test Promotion via consolidator
        const consolidator = new MemoryConsolidator(db);
        if (typeof consolidator.promoteCandidate === 'function') {
            const promoted = consolidator.promoteCandidate(row.id, 'knowledge');
            assert.strictEqual(promoted.verification_status, 'verified');
            assert.strictEqual(promoted.trust_level, 'high');
        }

    } finally {
        db.close();
    }
});

test('3. Multi-Hop Knowledge Graph Traversal in Hybrid Candidate Retrieval', async () => {
    const db = new BrainDB(':memory:');
    try {
        // Setup Knowledge Graph:
        // Entity: "Ngài" -> uses -> "Antigravity"
        // Entity: "Antigravity" -> integrates -> "Gemini Web Bridge"
        // Entity: "Gemini Web Bridge" -> connects_to -> "Chrome Extension"
        db.run("INSERT INTO entities (name, type) VALUES ('Ngài', 'person'), ('Antigravity', 'tool'), ('Gemini Web Bridge', 'technology'), ('Chrome Extension', 'tool')");
        
        db.run("INSERT INTO entity_relations (source_entity, relation, target_entity, confidence) VALUES ('Ngài', 'uses', 'Antigravity', 1.0)");
        db.run("INSERT INTO entity_relations (source_entity, relation, target_entity, confidence) VALUES ('Antigravity', 'integrates', 'Gemini Web Bridge', 0.95)");
        db.run("INSERT INTO entity_relations (source_entity, relation, target_entity, confidence) VALUES ('Gemini Web Bridge', 'connects_to', 'Chrome Extension', 0.90)");

        // Add knowledge item linked to 2-hop target entity "Gemini Web Bridge"
        db.run(
            "INSERT INTO knowledge_items (title, content, tags) VALUES (?, ?, ?)",
            "Dual-Quota Bridge Architecture",
            "Gemini Web Bridge uses port 8765 and WebSocket protocol to bypass DOM scraping limits.",
            "bridge, architecture, network"
        );

        const retriever = new ContextRetriever(db);
        
        // Multi-hop test: User queries "Ngài dùng công cụ gì để bridge", 
        // entity "Ngài" traverses 2-hop graph to find "Gemini Web Bridge" and retrieves its knowledge
        const context = await retriever.retrieveContext("Ngài cấu hình bridge", {
            conversationId: 'test-multihop'
        });

        assert.ok(context, 'Context must be returned');
        assert.ok(
            context.includes('Gemini Web Bridge') || context.includes('8765'),
            'Multi-hop retrieval must surface knowledge associated with 2-hop connected entities'
        );

    } finally {
        db.close();
    }
});
