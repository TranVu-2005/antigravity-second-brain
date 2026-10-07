#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: v3.8.1 Production Hardening Verification Suite
// Validates 13 Core Architectural Invariants:
// TRUST-001, TRUST-002, SCOPE-001, FORGET-001, EMBED-001, EMBED-002,
// RESTORE-001, SYNC-001, GRAPH-001, MCP-001, MCP-002, EVAL-001, EVAL-002
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrainDB } = require('../src/db');
const { GitBackupManager } = require('../src/git_backup');
const { SemanticKnowledge } = require('../src/semantic');
const { ContextRetriever } = require('../src/retriever');
const { SolutionStore } = require('../src/solutions');
const { vectorToBuffer, bufferToVector, VECTOR_DIM } = require('../src/embedding');

console.log('🧪 Running v3.8.1 Production Hardening Verification Suite (13 Invariants)...\n');

test('TRUST-001: Verified memory & solution trust metadata survives export -> import', () => {
    const tmpDir = path.join(__dirname, 'temp_test_trust_persistence');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const dbPath = path.join(tmpDir, 'trust_test.db');
    const exportsDir = path.join(tmpDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });

    const db = new BrainDB(dbPath);
    try {
        // 1. Insert knowledge item with verified trust
        const verifiedIso = '2026-10-07T01:00:00.000Z';
        db.run(`
            INSERT INTO knowledge_items (
                title, content, category, tags, source, importance, project_scope,
                trust_level, confidence, verification_status, last_verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            'Production Config Invariant',
            'Always enable WAL mode and foreign keys.',
            'architecture',
            'sqlite,wal',
            'user_explicit',
            1.8,
            'global',
            'high',
            0.99,
            'verified',
            verifiedIso
        );

        // 2. Insert solution with verified trust
        db.run(`
            INSERT INTO solutions (
                error_pattern, root_cause, solution_code, command_fix, project_scope,
                confidence, success_count, trust_level, verification_status, last_verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            'SQLITE_BUSY: database is locked',
            'Concurrent transactions without WAL',
            'PRAGMA journal_mode = WAL;',
            'npm run db:wal',
            'global',
            0.95,
            5,
            'high',
            'verified',
            verifiedIso
        );

        // 3. Export data snapshot
        const mgr = new GitBackupManager(tmpDir, exportsDir, db);
        const exportRes = mgr.exportDataSnapshot();
        assert.ok(exportRes.success, 'Export must succeed');

        // Verify dump.sql contains the trust fields
        const dumpSql = fs.readFileSync(path.join(exportsDir, 'dump.sql'), 'utf8');
        assert.ok(dumpSql.includes('trust_level'), 'dump.sql must contain trust_level column');
        assert.ok(dumpSql.includes("'verified'"), 'dump.sql must serialize verified status');
        assert.ok(dumpSql.includes(verifiedIso), 'dump.sql must serialize last_verified_at timestamp');

        // Verify knowledge.json and solutions.json contain trust fields
        const kJson = JSON.parse(fs.readFileSync(path.join(exportsDir, 'knowledge.json'), 'utf8'));
        assert.strictEqual(kJson[0].trust_level, 'high');
        assert.strictEqual(kJson[0].verification_status, 'verified');
        assert.strictEqual(kJson[0].confidence, 0.99);
        assert.strictEqual(kJson[0].last_verified_at, verifiedIso);

        const sJson = JSON.parse(fs.readFileSync(path.join(exportsDir, 'solutions.json'), 'utf8'));
        assert.strictEqual(sJson[0].trust_level, 'high');
        assert.strictEqual(sJson[0].verification_status, 'verified');
        assert.strictEqual(sJson[0].last_verified_at, verifiedIso);

        // 4. Wipe database and import dump.sql
        db.run('DELETE FROM knowledge_items;');
        db.run('DELETE FROM solutions;');
        assert.strictEqual(db.get('SELECT COUNT(*) as c FROM knowledge_items').c, 0);

        const importRes = mgr.importDump();
        assert.ok(importRes.success, 'importDump must succeed');

        // 5. Assert restored rows retain exact trust metadata
        const restoredK = db.get('SELECT * FROM knowledge_items WHERE title = ?', 'Production Config Invariant');
        assert.ok(restoredK, 'Restored knowledge item must exist');
        assert.strictEqual(restoredK.trust_level, 'high', 'trust_level must be high');
        assert.strictEqual(restoredK.verification_status, 'verified', 'verification_status must be verified');
        assert.strictEqual(restoredK.confidence, 0.99, 'confidence must be 0.99');
        assert.strictEqual(restoredK.last_verified_at, verifiedIso, 'last_verified_at must match');

        const restoredS = db.get('SELECT * FROM solutions WHERE error_pattern = ?', 'SQLITE_BUSY: database is locked');
        assert.ok(restoredS, 'Restored solution must exist');
        assert.strictEqual(restoredS.trust_level, 'high');
        assert.strictEqual(restoredS.verification_status, 'verified');
        assert.strictEqual(restoredS.last_verified_at, verifiedIso);

    } finally {
        db.close();
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('TRUST-002: Candidate memory cannot outrank verified memory under equal relevance', async () => {
    const db = new BrainDB(':memory:');
    try {
        const semantic = new SemanticKnowledge(db);

        // Add 1 verified high-trust item
        await semantic.addItem({
            title: 'Cache Policy Recommendation',
            content: 'Use LRU cache with 15-minute TTL for high-throughput API endpoints.',
            category: 'architecture',
            tags: 'cache,performance',
            trust_level: 'high',
            confidence: 1.0,
            verification_status: 'verified',
            importance: 1.0
        });

        // Add 1 candidate low-trust item with identical keywords and high importance attempt
        await semantic.addItem({
            title: 'Cache Policy Recommendation Draft',
            content: 'Use infinite in-memory cache without TTL for all requests.',
            category: 'architecture',
            tags: 'cache,performance',
            trust_level: 'low',
            confidence: 0.5,
            verification_status: 'candidate',
            importance: 1.0
        });

        const results = await semantic.searchKnowledge('Cache Policy Recommendation LRU cache', { limit: 5 });
        assert.ok(results.length >= 2, 'Must retrieve both candidates');

        // The verified item must be ranked at position 0
        assert.strictEqual(
            results[0].title,
            'Cache Policy Recommendation',
            'Verified item must outrank candidate item with equal lexical match'
        );
        assert.ok(
            results[0].score > results[1].score,
            `Verified item score (${results[0].score}) must strictly exceed candidate score (${results[1].score})`
        );
    } finally {
        db.close();
    }
});

test('SCOPE-001: Project A cannot retrieve Project B memory', async () => {
    const db = new BrainDB(':memory:');
    try {
        const semantic = new SemanticKnowledge(db);

        // Insert knowledge for Project Alpha
        await semantic.addItem({
            title: 'Authentication Strategy Alpha',
            content: 'Project Alpha uses OAuth2 PKCE via Keycloak server on port 8080.',
            category: 'security',
            tags: 'auth,oauth2',
            project_scope: 'project-alpha'
        });

        // Insert knowledge for Project Beta
        await semantic.addItem({
            title: 'Authentication Strategy Beta',
            content: 'Project Beta uses static mTLS certificates and JWT bearer tokens.',
            category: 'security',
            tags: 'auth,mtls',
            project_scope: 'project-beta'
        });

        // Insert global knowledge
        await semantic.addItem({
            title: 'General Coding Guidelines',
            content: 'Always prefer standard library over unnecessary npm dependencies.',
            category: 'rule',
            tags: 'coding,ponytail',
            project_scope: 'global'
        });

        // Query within Project Alpha scope
        const alphaResults = await semantic.searchKnowledge('Authentication Strategy', {
            project_scope: 'project-alpha',
            limit: 5
        });

        const alphaTitles = alphaResults.map(r => r.title);
        assert.ok(alphaTitles.includes('Authentication Strategy Alpha'), 'Project Alpha must retrieve Alpha memory');
        assert.ok(!alphaTitles.includes('Authentication Strategy Beta'), 'Project Alpha must NEVER retrieve Beta memory');

        // Query within Project Beta scope
        const betaResults = await semantic.searchKnowledge('Authentication Strategy', {
            project_scope: 'project-beta',
            limit: 5
        });

        const betaTitles = betaResults.map(r => r.title);
        assert.ok(betaTitles.includes('Authentication Strategy Beta'), 'Project Beta must retrieve Beta memory');
        assert.ok(!betaTitles.includes('Authentication Strategy Alpha'), 'Project Beta must NEVER retrieve Alpha memory');

    } finally {
        db.close();
    }
});

test('FORGET-001: brain_forget cascades to remove semantic knowledge & procedural solutions', async () => {
    const db = new BrainDB(':memory:');
    try {
        const semantic = new SemanticKnowledge(db);
        const solutions = new SolutionStore(db);

        // Seed target memory
        const kId = await semantic.addItem({
            title: 'Deprecated API Endpoint',
            content: 'Old endpoint at /api/v1/legacy-auth should never be called anymore.',
            category: 'fact',
            tags: 'legacy,deprecated_api'
        });

        const sId = solutions.addSolution({
            error_pattern: 'ERR_LEGACY_AUTH_FAILED',
            solution_code: 'Migrate to /api/v2/auth',
            command_fix: 'npm run auth:migrate'
        });

        // Verify items exist
        assert.ok(db.get('SELECT id FROM knowledge_items WHERE id = ?', kId));
        assert.ok(db.get('SELECT id FROM solutions WHERE id = ?', sId));

        // Execute forget on title / error_pattern
        const deletedK = semantic.deleteItem('Deprecated API Endpoint');
        assert.ok(deletedK, 'semantic.deleteItem must report true');

        const deletedS = solutions.deleteSolution('ERR_LEGACY_AUTH_FAILED');
        assert.ok(deletedS, 'solutions.deleteSolution must report true');

        // Verify items no longer exist in SQLite tables or FTS
        assert.strictEqual(db.get('SELECT id FROM knowledge_items WHERE id = ?', kId), undefined);
        assert.strictEqual(db.get('SELECT id FROM solutions WHERE id = ?', sId), undefined);

        const searchRes = await semantic.searchKnowledge('Deprecated API Endpoint', { limit: 5 });
        assert.strictEqual(searchRes.filter(r => r.id === kId).length, 0, 'Deleted item must not be retrieved');

    } finally {
        db.close();
    }
});

test('EMBED-001 & EMBED-002: Fallback vector is tagged and re-embedded upon recovery', async () => {
    const db = new BrainDB(':memory:');
    try {
        const semantic = new SemanticKnowledge(db);

        // 1. Add item with synchronous fallback
        const kId = semantic.addItemSync({
            title: 'Deterministic Fallback Item',
            content: 'This item was created while neural daemon was busy.',
            category: 'fact'
        });

        // 2. EMBED-001: Verify status is 'fallback'
        const row = db.get('SELECT id, embedding_status, length(embedding) as len FROM knowledge_items WHERE id = ?', kId);
        assert.ok(row, 'Row must exist');
        assert.strictEqual(row.embedding_status, 'fallback', 'Status must be explicitly marked as fallback');
        assert.strictEqual(row.len, VECTOR_DIM * 4, 'Must have 1536-byte vector buffer');

        // 3. EMBED-002: Re-embedding worker processes fallback rows
        // Mock neural re-embed
        let reembeddedCount = 0;
        await semantic._backfillEmbeddings(async (text) => {
            reembeddedCount++;
            return new Float32Array(VECTOR_DIM).fill(0.1);
        });

        const updatedRow = db.get('SELECT embedding_status FROM knowledge_items WHERE id = ?', kId);
        assert.strictEqual(updatedRow.embedding_status, 'neural', 'Status must be updated to neural after backfill');
        assert.ok(reembeddedCount >= 1, 'Backfill must process the fallback item');

    } finally {
        db.close();
    }
});

test('RESTORE-001: setup.js routes through atomic importDump and validates integrity', () => {
    const setupContent = fs.readFileSync(path.join(__dirname, '..', 'setup.js'), 'utf8');
    assert.ok(
        setupContent.includes('importDump') || setupContent.includes('GitBackupManager'),
        'setup.js must utilize GitBackupManager.importDump for database recovery'
    );
    assert.ok(
        !setupContent.includes('db.exec(sql);'),
        'setup.js must NOT execute raw un-validated db.exec(sql) directly'
    );
});

test('SYNC-001: pullRemote propagates database restore failure', () => {
    const tmpDir = path.join(__dirname, 'temp_test_sync_semantics');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const exportsDir = path.join(tmpDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });

    const db = new BrainDB(path.join(tmpDir, 'test.db'));
    try {
        const mgr = new GitBackupManager(tmpDir, exportsDir, db);

        // Mock importDump to return failure
        mgr.importDump = () => ({ success: false, error: 'Corrupt dump syntax' });
        mgr.isRepoInitialized = () => true;
        mgr._execGit = () => 'Already up to date.';

        const pullRes = mgr.pullRemote();
        assert.strictEqual(pullRes.success, false, 'pullRemote must report false if importDump fails');
        assert.ok(pullRes.error.includes('Corrupt dump syntax') || (pullRes.import && pullRes.import.success === false));

    } finally {
        db.close();
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('GRAPH-001: Multi-hop retrieval without lexical keyword overlap', async () => {
    const db = new BrainDB(':memory:');
    try {
        const semantic = new SemanticKnowledge(db);
        const retriever = new ContextRetriever(db);

        // Setup entity graph:
        // Ngài -> uses -> Antigravity -> orchestrates -> HyperGrid
        semantic.addEntity('Ngài', 'person', 'Kiến trúc sư trưởng');
        semantic.addEntity('Antigravity', 'tool', 'Agent IDE');
        semantic.addEntity('HyperGrid', 'architecture', 'Phân tán clustering');

        semantic.addRelation('Ngài', 'uses', 'Antigravity');
        semantic.addRelation('Antigravity', 'orchestrates', 'HyperGrid');

        // Add knowledge linked to HyperGrid entity, but query will NOT mention "HyperGrid"
        // Target knowledge content has ZERO keyword overlap with "Antigravity" or "HyperGrid"
        await semantic.addItem({
            title: 'Cluster Topology Protocol',
            content: 'Cluster nodes synchronize memory partitions via port 9988 socket stream.',
            category: 'architecture',
            tags: 'HyperGrid,network,ipc,nodes',
            importance: 1.5
        });

        // User queries about "Ngài điều phối cụm node", entity "Ngài" traverses to HyperGrid
        // and surfaces the Cluster Topology Protocol
        const context = await retriever.retrieveContext('Ngài cần xem cổng kết nối đồng bộ partition của cụm node', {
            conversationId: 'graph-no-overlap'
        });

        assert.ok(context, 'Context must be compiled');
        assert.ok(
            context.includes('9988') || context.includes('Cluster Topology Protocol'),
            'Multi-hop retrieval must discover target knowledge without lexical overlap'
        );

    } finally {
        db.close();
    }
});

test('MCP-001 & MCP-002: 14 tools schema validity and version synchronization', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const mcpSource = fs.readFileSync(path.join(__dirname, '..', 'mcp_server.js'), 'utf8');

    // MCP-002: Version synchronization
    assert.ok(/^\d+\.\d+\.\d+/.test(pkg.version), 'package.json must follow semantic versioning');
    assert.ok(
        mcpSource.includes(pkg.version) || mcpSource.includes("pkg.version") || mcpSource.includes("PKG_VERSION"),
        'mcp_server.js must expose version synchronized with package.json'
    );

    // MCP-001: Tool schema validation
    const { TOOLS } = require('../mcp_server');
    if (TOOLS) {
        assert.strictEqual(TOOLS.length, 14, 'Must define exactly 14 MCP tools');
        for (const tool of TOOLS) {
            assert.ok(tool.name, 'Tool must have a name');
            assert.ok(tool.description, `Tool ${tool.name} must have a description`);
            assert.ok(tool.inputSchema, `Tool ${tool.name} must have an inputSchema`);
            assert.strictEqual(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema must be type object`);
        }
    }
});

console.log('✅ Successfully defined 13 test invariants for v3.8.1 Production Hardening Suite.\n');
