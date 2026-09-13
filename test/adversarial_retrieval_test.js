// ==============================================================================
// Antigravity Second Brain: Empirical Adversarial Stress Test Harness
// Challenger Agent (challenger_1) — Verification & Robustness Harness
// ==============================================================================

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { BrainDB } = require('../src/db');
const { SemanticKnowledge } = require('../src/semantic');
const { ContextRetriever } = require('../src/retriever');
const { 
    computeEmbedding, 
    computeFallbackVector, 
    isDaemonHealthy,
    VECTOR_DIM 
} = require('../src/embedding');

const TEST_DB_PATH = path.join(__dirname, 'challenger_test_brain.db');

function cleanup() {
    for (const f of [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]) {
        if (fs.existsSync(f)) {
            try { fs.unlinkSync(f); } catch (e) {}
        }
    }
}

const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    findings: [],
    benchmarks: {}
};

function recordResult(testName, passed, errorOrDetails = null) {
    results.totalTests++;
    if (passed) {
        results.passed++;
        console.log(`  ✅ [PASS] ${testName}`);
    } else {
        results.failed++;
        console.error(`  ❌ [FAIL] ${testName}: ${errorOrDetails}`);
        results.findings.push({ testName, error: String(errorOrDetails) });
    }
}

async function runAdversarialSuite() {
    console.log('🔥 ===================================================================');
    console.log('🔥 ADVERSARIAL STRESS TEST HARNESS — SECOND BRAIN RETRIEVAL PIPELINE');
    console.log('🔥 ===================================================================\n');

    cleanup();
    const db = new BrainDB(TEST_DB_PATH);
    const semantic = new SemanticKnowledge(db);
    const retriever = new ContextRetriever();
    // Inject test DB into retriever components
    retriever.semantic = semantic;

    // Seed some test knowledge
    await semantic.addItem({
        title: 'Bảo mật API Key và Token',
        content: 'Tuyệt đối không lưu trữ khóa bí mật API trong mã nguồn git công khai.',
        category: 'security',
        tags: 'security,token,api',
        importance: 2.0
    });
    await semantic.addItem({
        title: 'Tối ưu hóa Node.js 24 SQLite Native',
        content: 'Sử dụng node:sqlite DatabaseSync với journal_mode WAL để đạt hiệu năng đọc ghi cao nhất.',
        category: 'tech_stack',
        tags: 'sqlite,wal,performance',
        importance: 1.5
    });
    await semantic.addItem({
        title: 'Cấu hình Docker Compose và Nginx Reverse Proxy',
        content: 'Hướng dẫn cài đặt nginx làm proxy ngược cho các microservices nội bộ.',
        category: 'devops',
        tags: 'docker,nginx,proxy',
        importance: 1.0
    });

    // =========================================================================
    // SUITE 1: Edge Cases & Type Handling
    // =========================================================================
    console.log('👉 [SUITE 1] Edge Cases & Type Handling');

    // 1.1 Empty string
    try {
        const res = await semantic.searchKnowledge('');
        assert.ok(Array.isArray(res) && res.length > 0, 'Empty string query should return default ranked items');
        recordResult('1.1 Empty string query to searchKnowledge', true);
    } catch (e) {
        recordResult('1.1 Empty string query to searchKnowledge', false, e.message);
    }

    // 1.2 Whitespace-only string
    try {
        const res = await semantic.searchKnowledge('     \t\n   ');
        assert.ok(Array.isArray(res) && res.length > 0, 'Whitespace query should return default items');
        recordResult('1.2 Whitespace-only query to searchKnowledge', true);
    } catch (e) {
        recordResult('1.2 Whitespace-only query to searchKnowledge', false, e.message);
    }

    // 1.3 null query
    try {
        const res = await semantic.searchKnowledge(null);
        assert.ok(Array.isArray(res) && res.length > 0, 'null query should be handled gracefully');
        recordResult('1.3 null query to searchKnowledge', true);
    } catch (e) {
        recordResult('1.3 null query to searchKnowledge', false, e.message);
    }

    // 1.4 undefined query
    try {
        const res = await semantic.searchKnowledge(undefined);
        assert.ok(Array.isArray(res) && res.length > 0, 'undefined query should be handled gracefully');
        recordResult('1.4 undefined query to searchKnowledge', true);
    } catch (e) {
        recordResult('1.4 undefined query to searchKnowledge', false, e.message);
    }

    // 1.5 Non-string inputs (number, boolean, object, array)
    try {
        const resNum = await semantic.searchKnowledge(12345);
        assert.ok(Array.isArray(resNum), 'Number query should not throw');
        recordResult('1.5a Number query (12345) to searchKnowledge', true);
    } catch (e) {
        recordResult('1.5a Number query (12345) to searchKnowledge', false, e.message);
    }

    try {
        const resObj = await semantic.searchKnowledge({ evil: true });
        assert.ok(Array.isArray(resObj), 'Object query should not throw');
        recordResult('1.5b Object query to searchKnowledge', true);
    } catch (e) {
        recordResult('1.5b Object query to searchKnowledge', false, e.message);
    }

    // ContextRetriever edge cases
    try {
        const ctxEmpty = await retriever.compileContext('');
        assert.ok(typeof ctxEmpty === 'string' && ctxEmpty.length > 0, 'compileContext with empty query succeeds');
        recordResult('1.6 compileContext empty string', true);
    } catch (e) {
        recordResult('1.6 compileContext empty string', false, e.message);
    }

    try {
        const ctxNull = await retriever.compileContext(null);
        assert.ok(typeof ctxNull === 'string' && ctxNull.length > 0, 'compileContext with null succeeds');
        recordResult('1.7 compileContext null query', true);
    } catch (e) {
        recordResult('1.7 compileContext null query', false, e.message);
    }

    try {
        const ctxNum = await retriever.compileContext(9999);
        assert.ok(typeof ctxNum === 'string', 'compileContext with number query succeeds');
        recordResult('1.8 compileContext number query (9999)', true);
    } catch (e) {
        recordResult('1.8 compileContext number query (9999)', false, e.message);
    }

    // 1.9 compileContext with options = null
    try {
        const ctxNullOpt = await retriever.compileContext('bảo mật', null, null);
        assert.ok(typeof ctxNullOpt === 'string', 'compileContext with options=null succeeds');
        recordResult('1.9 compileContext with options = null', true);
    } catch (e) {
        recordResult('1.9 compileContext with options = null', false, e.message);
    }

    // 1.10 searchKnowledge limit edge cases (0, negative, non-numeric)
    try {
        const resZero = await semantic.searchKnowledge('bảo mật', 0);
        assert.ok(Array.isArray(resZero) && resZero.length === 0, 'searchKnowledge limit=0 returns empty array');
        recordResult('1.10a searchKnowledge limit = 0', true);
    } catch (e) {
        recordResult('1.10a searchKnowledge limit = 0', false, e.message);
    }

    try {
        const resNeg = await semantic.searchKnowledge('bảo mật', -5);
        assert.ok(Array.isArray(resNeg), 'searchKnowledge limit = -5 handles cleanly');
        recordResult('1.10b searchKnowledge limit = -5', true);
    } catch (e) {
        recordResult('1.10b searchKnowledge limit = -5', false, e.message);
    }

    // =========================================================================
    // SUITE 2: Unicode, Emojis, Diacritics & Multilingual Queries
    // =========================================================================
    console.log('\n👉 [SUITE 2] Unicode, Emojis & Multilingual Robustness');

    // 2.1 Pure emoji query
    try {
        const res = await semantic.searchKnowledge('🚀🔥🎉💡🧠💻⚡️');
        assert.ok(Array.isArray(res), 'Pure emoji query should return array');
        recordResult('2.1 Pure emoji query', true);
    } catch (e) {
        recordResult('2.1 Pure emoji query', false, e.message);
    }

    // 2.2 Mixed Vietnamese + Emojis
    try {
        const res = await semantic.searchKnowledge('Hệ thống Second Brain của Ngài 🧠🚀 tối ưu hoá ra sao?');
        assert.ok(Array.isArray(res), 'Mixed Vietnamese + Emoji query should succeed');
        recordResult('2.2 Mixed Vietnamese + Emoji query', true);
    } catch (e) {
        recordResult('2.2 Mixed Vietnamese + Emoji query', false, e.message);
    }

    // 2.3 Zero-width characters & combining diacritics
    try {
        const query = 'B\u200B\u200C\u200Da\u0309o m\u00e2\u0323t T\u0300o\u0301k\u00ea\u0303n';
        const res = await semantic.searchKnowledge(query);
        assert.ok(Array.isArray(res), 'Zero-width & combining diacritics query should succeed');
        recordResult('2.3 Zero-width & combining diacritics query', true);
    } catch (e) {
        recordResult('2.3 Zero-width & combining diacritics query', false, e.message);
    }

    // 2.4 CJK & non-Latin scripts
    try {
        const res = await semantic.searchKnowledge('人工知能 第二の脳 データベース / الذكاء الاصطناعي');
        assert.ok(Array.isArray(res), 'CJK & Arabic query should succeed');
        recordResult('2.4 CJK & Arabic non-Latin script query', true);
    } catch (e) {
        recordResult('2.4 CJK & Arabic non-Latin script query', false, e.message);
    }

    // =========================================================================
    // SUITE 3: SQL Injection & FTS5 Syntax Malformation
    // =========================================================================
    console.log('\n👉 [SUITE 3] SQL Injection & FTS5 Syntax Malformation');

    const injectionPayloads = [
        { name: "Classic SQL ' OR 1=1", query: "' OR '1'='1' --" },
        { name: "Destructive DROP TABLE", query: "'; DROP TABLE knowledge_items; --" },
        { name: "UNION SELECT leak", query: "' UNION SELECT 1, 'injected', 'data', 'cat', 'tag', 'src', 9.9, 0, x'00', '2026', '2026' --" },
        { name: "FTS5 Boolean Trap: NOT AND OR", query: "NOT AND OR NEAR NOT" },
        { name: "FTS5 Special Chars: quotes & asterisks", query: '"""***^^^:::~~~((()))' },
        { name: "FTS5 Unbalanced Quotes", query: '"unclosed string literal without termination' },
        { name: "FTS5 Column Filter Injection", query: 'title: "secret" AND content: *' },
        { name: "FTS5 SQLite System Operators", query: "% _ [ ] ^ { } $ # @ ! ` ~" },
        { name: "JSON injection", query: '{"$where": "sleep(5000)"}' }
    ];

    for (const item of injectionPayloads) {
        try {
            const res = await semantic.searchKnowledge(item.query);
            assert.ok(Array.isArray(res), 'Search should return array');
            // Ensure DB integrity
            const count = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
            assert.ok(count >= 3, 'Database table must remain intact after injection attempt');
            recordResult(`3. Injection Payload: [${item.name}]`, true);
        } catch (e) {
            recordResult(`3. Injection Payload: [${item.name}]`, false, e.message);
        }
    }

    // Also test retriever.compileContext with injection
    try {
        const ctxInj = await retriever.compileContext("'; DROP TABLE entities; --");
        assert.ok(typeof ctxInj === 'string', 'compileContext handles injection safely');
        const entityCount = db.get('SELECT COUNT(*) as cnt FROM entities').cnt;
        assert.ok(entityCount > 0, 'Entities table must remain intact');
        recordResult('3.10 compileContext with SQL injection', true);
    } catch (e) {
        recordResult('3.10 compileContext with SQL injection', false, e.message);
    }

    // =========================================================================
    // SUITE 4: Extremely Long Queries (>500 to 10,000 chars)
    // =========================================================================
    console.log('\n👉 [SUITE 4] Extremely Long Queries & Buffer Stress');

    // 4.1 600-character complex query
    const longPrompt = "Ngài đã chỉ thị rất rõ ràng rằng Second Brain phải tối ưu hóa kiến trúc đa tầng bao gồm Tier 0 Core Identity, Tier 1 Entity Knowledge Graph, Tier 2 Episodic Memory, Tier 3 Semantic Knowledge, và Tier 4 Procedural Memory. Hãy tìm cho tôi các tài liệu liên quan đến bảo mật Token, Docker Nginx Reverse Proxy, cơ chế Reciprocal Rank Fusion kết hợp BM25 và Dense Vector Cosine Similarity trong Node.js 24 SQLite WAL journal mode một cách chi tiết nhất có thể để đảm bảo hệ thống không bị lỗi.";
    try {
        const start = performance.now();
        const res = await semantic.searchKnowledge(longPrompt);
        const duration = performance.now() - start;
        assert.ok(Array.isArray(res) && res.length > 0, 'Long query should return relevant results');
        assert.ok(res[0].title.includes('Bảo mật') || res[0].title.includes('SQLite'), 'Top result should be relevant');
        recordResult(`4.1 600-char complex query (${duration.toFixed(1)}ms)`, true);
    } catch (e) {
        recordResult('4.1 600-char complex query', false, e.message);
    }

    // 4.2 2,500-character query (500 words repeated)
    const repeatedQuery = "lỗi exception cannot connect to daemon ".repeat(50);
    try {
        const start = performance.now();
        const res = await semantic.searchKnowledge(repeatedQuery);
        const duration = performance.now() - start;
        assert.ok(Array.isArray(res), '2,500-char query returned array');
        recordResult(`4.2 2,500-char repeated query (${duration.toFixed(1)}ms)`, true);
    } catch (e) {
        recordResult('4.2 2,500-char repeated query', false, e.message);
    }

    // 4.3 10,000-character massive buffer query
    const hugeQuery = "A".repeat(10000);
    try {
        const start = performance.now();
        const res = await semantic.searchKnowledge(hugeQuery);
        const duration = performance.now() - start;
        assert.ok(Array.isArray(res), '10,000-char query returned array');
        recordResult(`4.3 10,000-char massive buffer query (${duration.toFixed(1)}ms)`, true);
    } catch (e) {
        recordResult('4.3 10,000-char massive buffer query', false, e.message);
    }

    // 4.4 10,000-char query in compileContext
    try {
        const start = performance.now();
        const ctxHuge = await retriever.compileContext(hugeQuery, null, { maxTokens: 400 });
        const duration = performance.now() - start;
        assert.ok(typeof ctxHuge === 'string', 'compileContext handles 10,000-char query');
        assert.ok(ctxHuge.length <= 400 * 3.5 + 500, 'Context compressor enforces budget');
        recordResult(`4.4 compileContext with 10,000-char query (${duration.toFixed(1)}ms)`, true);
    } catch (e) {
        recordResult('4.4 compileContext with 10,000-char query', false, e.message);
    }

    // =========================================================================
    // SUITE 5: Out-of-Vocabulary & Boundary Pre-filtering (>50 records)
    // =========================================================================
    console.log('\n👉 [SUITE 5] Out-of-Vocabulary & Pre-filtering (>50 items) Boundary');

    // 5.1 Gibberish query
    try {
        const res = await semantic.searchKnowledge('xyzzy_nonexistent_word_1234567890_qwertyuiop');
        assert.ok(Array.isArray(res), 'OOV query returns array');
        recordResult('5.1 Out-of-vocabulary query', true);
    } catch (e) {
        recordResult('5.1 Out-of-vocabulary query', false, e.message);
    }

    // 5.2 Pre-filtering boundary condition (>50 items in database)
    console.log('  Adding items to exceed 50 knowledge items threshold (totalCount > 50)...');
    for (let i = 0; i < 50; i++) {
        semantic.addItemSync({
            title: `Synthetic Knowledge Item #${i + 1}`,
            content: `Synthetic test content number ${i + 1} for stress testing candidate pre-filter.`,
            category: 'synthetic',
            tags: `test,synth,item${i}`,
            importance: 0.5
        });
    }
    const currentCount = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
    console.log(`  Database now has ${currentCount} items (> 50 threshold active).`);

    // Test standard query with >50 items
    try {
        const res = await semantic.searchKnowledge('Bảo mật Token');
        assert.ok(res.length > 0 && res[0].title.includes('Bảo mật'), 'Standard query succeeds with >50 items');
        recordResult('5.2a Hybrid search with totalCount > 50', true);
    } catch (e) {
        recordResult('5.2a Hybrid search with totalCount > 50', false, e.message);
    }

    // Test Boundary: Category filter with ZERO matches when totalCount > 50!
    // In src/semantic.js line 226: if candidateIdSet is empty, placeholders is "" -> SELECT WHERE id IN ()
    try {
        const resNonExistentCat = await semantic.searchKnowledge('Bảo mật Token', 5, 'non_existent_category_999');
        assert.ok(Array.isArray(resNonExistentCat), 'Query with non-existent category returned array');
        recordResult('5.2b Non-existent category filter with totalCount > 50', true);
    } catch (e) {
        recordResult('5.2b Non-existent category filter with totalCount > 50', false, e.message);
    }

    // Test Boundary: OOV query + Category filter with zero matches
    try {
        const resOovCat = await semantic.searchKnowledge('blarg_no_match_xyz', 5, 'another_empty_cat');
        console.log(`  resOovCat returned: length=${resOovCat.length}`);
        assert.ok(Array.isArray(resOovCat), 'OOV query + non-existent category returns array');
        recordResult('5.2c OOV query + non-existent category with totalCount > 50', true);
    } catch (e) {
        recordResult('5.2c OOV query + non-existent category with totalCount > 50', false, e.message);
    }

    // =========================================================================
    // SUITE 6: Embedding Daemon Fallback Resilience (Online vs Offline)
    // =========================================================================
    console.log('\n👉 [SUITE 6] Embedding Daemon Fallback Resilience');

    const daemonHealthy = await isDaemonHealthy();
    console.log(`  Current daemon health status: ${daemonHealthy ? 'ONLINE ✅' : 'OFFLINE ⚠️'}`);

    if (daemonHealthy) {
        // Test 6.1 Online embedding calculation
        try {
            const start = performance.now();
            const vec = await computeEmbedding('Kiểm tra vector neural online');
            const latency = performance.now() - start;
            assert.strictEqual(vec.length, VECTOR_DIM, `Vector dimension must be ${VECTOR_DIM}`);
            assert.ok(vec instanceof Float32Array, 'Must be Float32Array');
            recordResult(`6.1 Online neural embedding calculation (${latency.toFixed(1)}ms)`, true);
        } catch (e) {
            recordResult('6.1 Online neural embedding calculation', false, e.message);
        }
    }

    // Test 6.2 Deterministic fallback vector generation via computeEmbeddingSync
    try {
        const { computeEmbeddingSync } = require('../src/embedding');
        const start = performance.now();
        // Use unique string to ensure it's not in cache
        const fallbackVec = computeEmbeddingSync(`fallback_test_${Date.now()}_${Math.random()}`);
        const latency = performance.now() - start;
        assert.strictEqual(fallbackVec.length, VECTOR_DIM, `Fallback dimension must be ${VECTOR_DIM}`);
        assert.ok(fallbackVec instanceof Float32Array, 'Fallback must be Float32Array');
        
        // Verify L2 normalization: sqrt(sum(v_i^2)) ≈ 1.0
        let sumSq = 0;
        for (let i = 0; i < fallbackVec.length; i++) sumSq += fallbackVec[i] * fallbackVec[i];
        const norm = Math.sqrt(sumSq);
        assert.ok(Math.abs(norm - 1.0) < 1e-4, `Fallback vector must be unit L2 norm (got ${norm})`);
        recordResult(`6.2 Fallback vector L2 normalization & dimension (${latency.toFixed(2)}ms)`, true);
    } catch (e) {
        recordResult('6.2 Fallback vector L2 normalization', false, e.message);
    }

    // Test 6.3 Offline Simulation via mock unreachable host
    console.log('  Testing fallback behavior when endpoint is unreachable...');
    try {
        const origFetch = global.fetch;
        let offlineVec;
        let offlineLatency;
        try {
            global.fetch = async () => { throw new Error('ECONNREFUSED 127.0.0.1:49152'); };
            const start = performance.now();
            const offlineText = `offline_probe_${Date.now()}_${Math.random()}`;
            offlineVec = await computeEmbedding(offlineText);
            offlineLatency = performance.now() - start;
        } finally {
            global.fetch = origFetch;
        }

        assert.strictEqual(offlineVec.length, VECTOR_DIM, 'Offline vector has correct dimension');
        assert.ok(offlineVec instanceof Float32Array, 'Offline vector is Float32Array');
        recordResult(`6.3 Offline fallback vector generation on fetch error (${offlineLatency.toFixed(1)}ms)`, true);
    } catch (e) {
        recordResult('6.3 Offline fallback vector generation', false, e.message);
    }

    // Test 6.4 Hybrid search resilience during simulated daemon downtime
    try {
        const origFetch = global.fetch;
        let offlineSearchResults;
        try {
            global.fetch = async () => { throw new Error('ECONNREFUSED 127.0.0.1:49152'); };
            offlineSearchResults = await semantic.searchKnowledge(`offline_search_${Date.now()}`);
        } finally {
            global.fetch = origFetch;
        }
        assert.ok(Array.isArray(offlineSearchResults), 'Search succeeds even when daemon is completely down');
        recordResult('6.4 Hybrid search execution under simulated daemon downtime', true);
    } catch (e) {
        recordResult('6.4 Hybrid search execution under daemon downtime', false, e.message);
    }

    // =========================================================================
    // SUITE 7: Rapid Consecutive Load & Memory Stability Stress
    // =========================================================================
    console.log('\n👉 [SUITE 7] Rapid Consecutive Load (100 queries) & Memory Stability');

    const NUM_QUERIES = 100;
    const testQueries = [
        'Bảo mật API Key và Token',
        'Tối ưu hóa Node.js 24 SQLite Native',
        'Docker Nginx Reverse Proxy',
        'Lỗi syntax error powershell',
        'Chỉ thị phục vụ Ngài',
        'Ngài uses Antigravity',
        'Synthetic test content 25',
        'Nonexistent random query 12345',
        'Hệ thống Second Brain 🧠🚀',
        "'; DROP TABLE solutions; --"
    ];

    const latencies = [];
    const memBefore = process.memoryUsage();

    const burstStart = performance.now();
    for (let i = 0; i < NUM_QUERIES; i++) {
        const q = testQueries[i % testQueries.length] + ` (iteration ${i})`;
        const qStart = performance.now();
        await semantic.searchKnowledge(q, 5);
        latencies.push(performance.now() - qStart);
    }
    const totalBurstDuration = performance.now() - burstStart;
    const memAfter = process.memoryUsage();

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p90 = latencies[Math.floor(latencies.length * 0.90)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const heapDiffMB = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
    const rssDiffMB = (memAfter.rss - memBefore.rss) / (1024 * 1024);

    results.benchmarks.rapidQueries = {
        count: NUM_QUERIES,
        totalDurationMs: Number(totalBurstDuration.toFixed(1)),
        avgMs: Number(avgLatency.toFixed(2)),
        p50Ms: Number(p50.toFixed(2)),
        p90Ms: Number(p90.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        p99Ms: Number(p99.toFixed(2)),
        heapUsedBeforeMB: Number((memBefore.heapUsed / 1024 / 1024).toFixed(2)),
        heapUsedAfterMB: Number((memAfter.heapUsed / 1024 / 1024).toFixed(2)),
        heapDiffMB: Number(heapDiffMB.toFixed(2)),
        rssDiffMB: Number(rssDiffMB.toFixed(2))
    };

    console.log(`  Processed ${NUM_QUERIES} queries in ${totalBurstDuration.toFixed(1)}ms`);
    console.log(`  Latency: avg=${avgLatency.toFixed(2)}ms, p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);
    console.log(`  Memory delta: Heap = ${heapDiffMB >= 0 ? '+' : ''}${heapDiffMB.toFixed(2)} MB, RSS = ${rssDiffMB >= 0 ? '+' : ''}${rssDiffMB.toFixed(2)} MB`);

    const latencyAcceptable = p95 < 100; // < 100ms
    const memoryStable = heapDiffMB < 50; // Heap growth < 50MB for 100 queries
    recordResult(`7.1 Latency under rapid consecutive queries (p95 = ${p95.toFixed(1)}ms < 100ms)`, latencyAcceptable);
    recordResult(`7.2 Memory stability under rapid consecutive queries (heap diff = ${heapDiffMB.toFixed(2)}MB < 50MB)`, memoryStable);

    // =========================================================================
    // SUMMARY REPORT
    // =========================================================================
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`🏁 ADVERSARIAL STRESS TEST COMPLETE: ${results.passed}/${results.totalTests} PASSED`);
    console.log(`   Passed: ${results.passed} | Failed: ${results.failed}`);
    console.log('═══════════════════════════════════════════════════════════════════');

    if (results.failed > 0) {
        console.log('\n🚨 DETECTED FAILURE MODES:');
        for (const f of results.findings) {
            console.log(`  - [${f.testName}]: ${f.error}`);
        }
    }

    cleanup();

    // Export results for handoff analysis
    return results;
}

if (require.main === module) {
    runAdversarialSuite()
        .then(res => {
            if (res.failed > 0) {
                process.exit(1);
            } else {
                process.exit(0);
            }
        })
        .catch(err => {
            console.error('Fatal crash during stress test harness execution:', err);
            process.exit(2);
        });
}

module.exports = { runAdversarialSuite };
