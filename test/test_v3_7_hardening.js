#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: v3.7 Hardening & Robustness Test Suite
// Rigorous verification of Security, Bi-temporal Graph, Full Recovery & Sanitization
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrainDB } = require('../src/db');
const { GitBackupManager } = require('../src/git_backup');
const { SemanticKnowledge } = require('../src/semantic');
const { getEmbeddingHealth, VECTOR_DIM } = require('../src/embedding');

console.log('🧪 Bắt đầu chạy bộ kiểm thử v3.7 Production Hardening Suite...\n');

// Helper to create an isolated in-memory test database with full v3.7 schema
function createTestDB() {
    return new BrainDB(':memory:');
}

test('1. Security: Command Injection Resistance in Git Subsystem', () => {
    const tmpBrainDir = path.join(__dirname, 'temp_test_git_brain');
    if (fs.existsSync(tmpBrainDir)) fs.rmSync(tmpBrainDir, { recursive: true, force: true });
    fs.mkdirSync(tmpBrainDir, { recursive: true });

    try {
        const mgr = new GitBackupManager(tmpBrainDir, path.join(tmpBrainDir, 'exports'));

        // A. Test invalid/malicious URLs are rejected safely
        const maliciousUrls = [
            'https://github.com/user/repo.git; echo PWNED',
            'https://github.com/user/repo.git && calc.exe',
            'https://github.com/user/repo.git | cat /etc/passwd',
            'https://github.com/user/repo.git $(whoami)',
            '`touch pwned`'
        ];

        for (const url of maliciousUrls) {
            const res = mgr.setRemote(url);
            assert.strictEqual(res.success, false, `URL chứa ký tự nguy hiểm phải bị từ chối: ${url}`);
        }

        // B. Test legitimate URL is accepted
        const validRes = mgr.setRemote('https://github.com/test-owner/test-repo.git');
        assert.strictEqual(validRes.success, true);
        assert.strictEqual(validRes.remoteUrl, 'https://github.com/test-owner/test-repo.git');

    } finally {
        if (fs.existsSync(tmpBrainDir)) {
            fs.rmSync(tmpBrainDir, { recursive: true, force: true });
        }
    }
});

test('2. Security: Pre-Commit Secret Scanner and Staging Allowlist', () => {
    const tmpDir = path.join(__dirname, 'temp_test_secret_brain');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
        const exportsDir = path.join(tmpDir, 'exports');
        fs.mkdirSync(exportsDir, { recursive: true });
        const mgr = new GitBackupManager(tmpDir, exportsDir);

        // Test secret detection
        const testSecretFile = path.join(exportsDir, 'profile.json');
        
        // Safe profile
        fs.writeFileSync(testSecretFile, JSON.stringify([{ key: 'theme', value: 'dark' }]), 'utf8');
        assert.strictEqual(mgr.scanForSecrets(testSecretFile), null, 'Safe file must not trigger alert');

        // File with leaked private key
        fs.writeFileSync(testSecretFile, '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...', 'utf8');
        const leak1 = mgr.scanForSecrets(testSecretFile);
        assert.ok(leak1, 'Phải phát hiện rò rỉ Private Key');
        assert.strictEqual(leak1.pattern, 'Private Key');

        // File with leaked GitHub Token
        fs.writeFileSync(testSecretFile, '{"token": "ghp_123456789012345678901234567890123456"}', 'utf8');
        const leak2 = mgr.scanForSecrets(testSecretFile);
        assert.ok(leak2, 'Phải phát hiện rò rỉ GitHub Token');
        assert.strictEqual(leak2.pattern, 'GitHub Token');

        // File with leaked OpenAI API Key
        fs.writeFileSync(testSecretFile, '{"apiKey": "sk-proj-123456789012345678901234567890"}', 'utf8');
        const leak3 = mgr.scanForSecrets(testSecretFile);
        assert.ok(leak3, 'Phải phát hiện rò rỉ API Key');
        assert.strictEqual(leak3.pattern, 'OpenAI/Anthropic API Key');

    } finally {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }
});

test('3. Data Modeling: Bi-Temporal Entity Graph Lifecycle (A -> B -> C -> A)', () => {
    const db = createTestDB();
    const sem = new SemanticKnowledge(db);

    // Step 1: Ngài prefers Dark Mode
    const res1 = sem.addRelation('Ngài', 'prefers', 'Dark Mode');
    assert.strictEqual(res1, true);

    const activePref1 = sem.getGraph(false).relations.filter(r => r.relation === 'prefers');
    assert.strictEqual(activePref1.length, 1);
    assert.strictEqual(activePref1[0].target, 'Dark Mode');

    // Step 2: Ngài changes preference to Light Mode (supersedes Dark Mode)
    const res2 = sem.addRelation('Ngài', 'prefers', 'Light Mode');
    assert.strictEqual(res2, true);

    const activePref2 = sem.getGraph(false).relations.filter(r => r.relation === 'prefers');
    assert.strictEqual(activePref2.length, 1);
    assert.strictEqual(activePref2[0].target, 'Light Mode', 'Quan hệ hiện tại phải là Light Mode');

    const historyPref2 = sem.getGraph(true).relations.filter(r => r.relation === 'prefers');
    assert.strictEqual(historyPref2.length, 2, 'Lịch sử phải bảo toàn cả 2 quan hệ');

    // Step 3: Ngài reverts preference back to Dark Mode! (A -> B again)
    // In legacy schema, this caused a UNIQUE constraint collision or overwritten history.
    // In v3.7, it safely inserts a 3rd record with a new timeline!
    const res3 = sem.addRelation('Ngài', 'prefers', 'Dark Mode');
    assert.strictEqual(res3, true, 'Quay lại Dark Mode phải thành công');

    const activePref3 = sem.getGraph(false).relations.filter(r => r.relation === 'prefers');
    assert.strictEqual(activePref3.length, 1);
    assert.strictEqual(activePref3[0].target, 'Dark Mode', 'Quan hệ hiện tại phải quay lại Dark Mode');

    const historyPref3 = sem.getGraph(true).relations.filter(r => r.relation === 'prefers');
    assert.strictEqual(historyPref3.length, 3, 'Lịch sử phải bảo toàn trọn vẹn cả 3 giai đoạn: Dark -> Light -> Dark');

    const darkHistory = historyPref3.filter(r => r.target === 'Dark Mode');
    assert.strictEqual(darkHistory.length, 2, 'Phải có 2 bản ghi lịch sử độc lập cho Dark Mode');
    assert.ok(darkHistory.some(r => r.valid_until !== null), 'Bản ghi Dark Mode cũ phải có valid_until');
    assert.ok(darkHistory.some(r => r.valid_until === null), 'Bản ghi Dark Mode mới phải có valid_until = NULL');
});

test('4. Complete Snapshot & Restore: Episodes Content & Entities Parity', () => {
    const db = createTestDB();

    // Populate sample data across all tiers
    db.run("INSERT INTO user_profile (category, key, value) VALUES ('style', 'honorific', 'Ngài')");
    db.run("INSERT INTO entities (name, type, description) VALUES ('Antigravity', 'platform', 'AI Agent System')");
    db.run("INSERT INTO conversations (id, title, summary, message_count) VALUES ('conv-101', 'Test Session', 'Summary of test', 2)");
    db.run(`
        INSERT INTO episodes (conversation_id, step_index, role, content, summary, tags) 
        VALUES ('conv-101', 1, 'user', 'Nội dung chi tiết của câu hỏi số 1 từ Ngài', 'Tóm tắt 1', 'test,query')
    `);
    db.run(`
        INSERT INTO episodes (conversation_id, step_index, role, content, summary, tags) 
        VALUES ('conv-101', 2, 'assistant', 'Câu trả lời chi tiết số 2 từ Antigravity', 'Tóm tắt 2', 'test,reply')
    `);
    db.run("INSERT INTO knowledge_items (title, content, category) VALUES ('Quy tắc tối giản', 'Tuân thủ triết lý Ponytail', 'rule')");
    db.run("INSERT INTO solutions (error_pattern, solution_code) VALUES ('EADDRINUSE', 'kill -9 $(lsof -t -i:8080)')");
    db.run("INSERT INTO entity_relations (source_entity, relation, target_entity) VALUES ('Ngài', 'uses', 'Antigravity')");

    const tmpDir = path.join(__dirname, 'temp_test_restore_brain');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
        const exportsDir = path.join(tmpDir, 'exports');
        fs.mkdirSync(exportsDir, { recursive: true });

        const mgr = new GitBackupManager(tmpDir, exportsDir, db);
        const snapshotStats = mgr.exportDataSnapshot();

        // Verify exported snapshot files
        assert.ok(fs.existsSync(path.join(exportsDir, 'episodes_log.json')));
        assert.ok(fs.existsSync(path.join(exportsDir, 'entities.json')));
        assert.ok(fs.existsSync(path.join(exportsDir, 'dump.sql')));

        const exportedEpisodes = JSON.parse(fs.readFileSync(path.join(exportsDir, 'episodes_log.json'), 'utf8'));
        assert.strictEqual(exportedEpisodes.length, 2);
        assert.ok(exportedEpisodes[0].content.includes('Nội dung chi tiết'), 'Episodes log phải bảo toàn content');

        const exportedEntities = JSON.parse(fs.readFileSync(path.join(exportsDir, 'entities.json'), 'utf8'));
        assert.strictEqual(exportedEntities.length, 1);
        assert.strictEqual(exportedEntities[0].name, 'Antigravity');

        // Now test restoring into a completely fresh empty database
        const cleanDB = createTestDB();
        const restoreMgr = new GitBackupManager(tmpDir, exportsDir, cleanDB);

        const restoreRes = restoreMgr.importDump();
        assert.strictEqual(restoreRes.success, true);
        assert.strictEqual(restoreRes.counts.episodes, 2, 'Phải phục hồi đủ 2 episodes');
        assert.strictEqual(restoreRes.counts.entities, 1, 'Phải phục hồi đủ 1 entity');
        assert.strictEqual(restoreRes.counts.knowledge, 1, 'Phải phục hồi đủ 1 knowledge item');
        assert.strictEqual(restoreRes.counts.solutions, 1, 'Phải phục hồi đủ 1 solution');

        // Test FTS5 search works after restore
        const ftsResult = cleanDB.prepare("SELECT * FROM episodes_fts WHERE episodes_fts MATCH 'chi tiết'").all();
        assert.ok(ftsResult.length > 0, 'FTS index phải hoạt động hoàn hảo sau khi import');

    } finally {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }
});

test('5. Observability: Embedding Subsystem Health States', async () => {
    const health = await getEmbeddingHealth();
    assert.ok(health);
    assert.ok(['READY', 'DEGRADED', 'UNAVAILABLE'].includes(health.status));
    assert.strictEqual(health.dimension, VECTOR_DIM);
    assert.ok(typeof health.message === 'string');
});

test('6. Decoupled Architecture: Independent Private Data Store Isolation', () => {
    const tmpBrainDir = path.join(__dirname, 'temp_test_dual_brain');
    const tmpExportsDir = path.join(tmpBrainDir, 'exports');
    if (fs.existsSync(tmpBrainDir)) fs.rmSync(tmpBrainDir, { recursive: true, force: true });
    fs.mkdirSync(tmpExportsDir, { recursive: true });

    try {
        const testDB = createTestDB();
        testDB.run("INSERT INTO user_profile (category, key, value) VALUES ('identity', 'role', 'Architect')");
        const mgr = new GitBackupManager(tmpBrainDir, tmpExportsDir, testDB);

        // Commit snapshot to data repo
        const commitRes = mgr.commitBackup('Initial data test commit');
        assert.strictEqual(commitRes.success, true);
        assert.strictEqual(commitRes.committed, true);

        // Verify that .git exists inside tmpExportsDir (Private Data Store)
        assert.ok(fs.existsSync(path.join(tmpExportsDir, '.git')), 'exports/ phải là một Git repo độc lập');

        // Verify that parent tmpBrainDir does NOT have .git created by backup
        assert.ok(!fs.existsSync(path.join(tmpBrainDir, '.git')), 'Engine dir không bị ô nhiễm bởi data backup');

        // Verify data status reflects the exports repository
        const dataStatus = mgr.getDataStatus();
        assert.strictEqual(dataStatus.initialized, true);
        assert.strictEqual(dataStatus.isDataRepo, true);
        assert.ok(dataStatus.lastCommit.includes('Initial data test commit'));

    } finally {
        if (fs.existsSync(tmpBrainDir)) {
            fs.rmSync(tmpBrainDir, { recursive: true, force: true });
        }
    }
});

