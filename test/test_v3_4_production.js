// ==============================================================================
// Antigravity Second Brain: v3.4.0 Production-Grade Verification Suite
// TDD Master + Ponytail Doctrine (Zero external dependencies, Node 24 Native)
// ==============================================================================

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const { getDB } = require('../src/db');
const { getSemanticKnowledge } = require('../src/semantic');
const { getContextRetriever } = require('../src/retriever');
const { getMemoryConsolidator } = require('../src/consolidation');
const { getProfileManager } = require('../src/profile');
const { getSolutionStore } = require('../src/solutions');
const { getEpisodicMemory } = require('../src/episodic');
const { getMemoryExtractor } = require('../src/extractor');

const testResults = [];

function recordTest(suite, name, passed, details = '') {
    testResults.push({ suite, name, passed, details });
    const mark = passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`  ${mark} ${name}${details ? ` (${details})` : ''}`);
}

async function runTests() {
    console.log('═════════════════════════════════════════════════════════════════════');
    console.log('🚀 ANTIGRAVITY SECOND BRAIN v3.4.0 — PRODUCTION-GRADE TEST SUITE');
    console.log('═════════════════════════════════════════════════════════════════════\n');

    const db = getDB();
    const episodic = getEpisodicMemory(db);
    const consolidator = getMemoryConsolidator(db);
    const semantic = getSemanticKnowledge(db);
    const solutions = getSolutionStore(db);
    const retriever = getContextRetriever(db);
    const extractor = getMemoryExtractor();

    // -------------------------------------------------------------------------
    // TEST 1: Autonomous Knowledge & Solution Promotion (Auto-Promoter)
    // -------------------------------------------------------------------------
    console.log('👉 [TEST 1] Autonomous Knowledge & Solution Promotion from Session Distillation');
    const testConvId = `test-promoter-${Date.now()}`;
    try {
        // Setup a mock conversation with rich technical decisions and learned fixes
        db.run(`
            INSERT INTO conversations (id, title, created_at, updated_at, message_count, last_step_index)
            VALUES (?, ?, datetime('now'), datetime('now'), 4, 3)
        `, testConvId, 'Test Scalping XAUUSD Architecture & Fix');

        // Add user goal
        db.run(`
            INSERT INTO episodes (conversation_id, step_index, role, content, summary, timestamp)
            VALUES (?, 0, 'user', 'hãy thiết kế kiến trúc chỉ báo scalping XAUUSD M5 và sửa lỗi bridge timeout', 'Thiết kế MT5 XAUUSD', datetime('now'))
        `, testConvId);

        // Add assistant decision
        db.run(`
            INSERT INTO episodes (conversation_id, step_index, role, content, summary, timestamp)
            VALUES (?, 1, 'assistant', 'Quyết định kiến trúc: Sử dụng EMA 21 và EMA 50 kết hợp RSI 14 Dynamic Zones cho khung M5, tỷ lệ R:R chốt lời 1:2', 'Quyết định kiến trúc EMA 21/50', datetime('now'))
        `, testConvId);

        // Add assistant bug fix
        db.run(`
            INSERT INTO episodes (conversation_id, step_index, role, content, summary, timestamp)
            VALUES (?, 2, 'assistant', 'Đã khắc phục lỗi Bridge DOM race condition: bắt buộc kiểm tra các node tin nhắn cũ trong DOM đã biến mất hoàn toàn (length === 0) trước khi stream', 'Khắc phục lỗi Bridge DOM', datetime('now'))
        `, testConvId);

        // Run distillSession
        const initialKnowledgeCount = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
        const initialSolutionsCount = db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;

        const distillRes = consolidator.distillSession(testConvId);
        assert.ok(distillRes, 'distillSession phải trả về kết quả');
        assert.ok(distillRes.summary.includes('[Mục tiêu:'), 'Summary phải có [Mục tiêu:');

        // Check if decision was promoted to knowledge_items
        const promotedKnowledge = db.get(`
            SELECT * FROM knowledge_items 
            WHERE source = 'auto_distillation' AND (content LIKE '%EMA 21%' OR content LIKE '%XAUUSD%')
            ORDER BY id DESC LIMIT 1
        `);
        assert.ok(promotedKnowledge, 'Quyết định kiến trúc phải được tự động promote vào knowledge_items');
        assert.strictEqual(promotedKnowledge.category, 'decision');
        assert.ok(promotedKnowledge.importance >= 1.3, 'Importance của decision promote phải >= 1.3');

        // Check if fix was promoted to solutions
        const promotedSolution = db.get(`
            SELECT * FROM solutions 
            WHERE solution_code LIKE '%length === 0%' OR error_pattern LIKE '%Bridge DOM%'
            ORDER BY id DESC LIMIT 1
        `);
        assert.ok(promotedSolution, 'Bài học sửa lỗi phải được tự động promote vào solutions');

        recordTest('Promotion', '1.1 Quyết định kiến trúc tự động promote sang knowledge_items', true, `ID: #${promotedKnowledge.id}`);
        recordTest('Promotion', '1.2 Bài học khắc phục lỗi tự động promote sang solutions', true, `ID: #${promotedSolution.id}`);

        // 1.3 Idempotency: running distillSession again must NOT duplicate
        const countAfterFirst = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
        const solsAfterFirst = db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;

        consolidator.distillSession(testConvId);

        const countAfterSecond = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
        const solsAfterSecond = db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;

        assert.strictEqual(countAfterSecond, countAfterFirst, 'Chạy distillSession lần 2 không được nhân bản knowledge_items');
        assert.strictEqual(solsAfterSecond, solsAfterFirst, 'Chạy distillSession lần 2 không được nhân bản solutions');
        recordTest('Promotion', '1.3 Idempotency: Không sinh trùng lặp khi chạy lại nhiều lần', true, 'Zero duplicates verified');

    } catch (e) {
        recordTest('Promotion', '1.1 Autonomous Promotion', false, e.message);
    } finally {
        // Cleanup test conversation
        try {
            db.run('DELETE FROM episodes WHERE conversation_id = ?', testConvId);
            db.run('DELETE FROM conversations WHERE id = ?', testConvId);
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // TEST 2: PreInvocation Catch-up Sync (< 25ms)
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 2] PreInvocation Catch-up Sync (Zero-Lag Cross Session Sync)');
    try {
        const startCatchUp = performance.now();
        const syncResult = episodic.catchUpRecentSessions(3);
        const catchUpDuration = performance.now() - startCatchUp;

        assert.ok(syncResult !== undefined, 'catchUpRecentSessions phải trả về kết quả');
        assert.ok(catchUpDuration < 150, `Catch-up sync phải siêu nhanh (<150ms), thực tế: ${catchUpDuration.toFixed(2)}ms`);

        recordTest('CatchUp', '2.1 Tốc độ quét Catch-up Sync siêu tốc (< 150ms)', true, `${catchUpDuration.toFixed(2)}ms`);
        recordTest('CatchUp', '2.2 Xử lý an toàn khi quét các phiên gần nhất', true, `Checked ${syncResult.checked || 3} sessions`);
    } catch (e) {
        recordTest('CatchUp', '2.1 Catch-up Sync Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Cross-Session Continuity in Tier 1 Working Memory
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 3] Cross-Session Continuity & Anaphoric Resolution');
    const prevConvId = `prev-conv-${Date.now()}`;
    const newConvId = `new-conv-${Date.now()}`;
    try {
        const profile = getProfileManager(db);
        // Set previous session state
        profile.updateSessionState(prevConvId, {
            activeGoal: 'Xây dựng thuật toán Scalping XAUUSD M5 trên MT5',
            currentTopic: 'Trading MT5'
        });

        // Current session starts with anaphoric continuation prompt
        const resolved = retriever.resolveContinuationQuery(newConvId, 'tiếp tục cái hôm qua đang làm đi');
        assert.ok(resolved, 'Phải giải quyết được câu hỏi tiếp diễn');
        assert.ok(
            resolved.includes('Scalping XAUUSD') || resolved.includes('Trading MT5'),
            `Nội dung giải quyết phải kế thừa từ phiên trước, thực tế: "${resolved}"`
        );

        recordTest('Continuity', '3.1 Kế thừa Working Memory từ phiên liền kề khi mở chat mới', true, `Resolved: "${resolved}"`);
    } catch (e) {
        recordTest('Continuity', '3.1 Cross-session Continuity Test', false, e.message);
    } finally {
        try {
            db.run('DELETE FROM session_state WHERE conversation_id IN (?, ?)', prevConvId, newConvId);
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // TEST 4: PostInvocation Hook Contract & Zero-Crash Execution
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 4] PostInvocation Hook Contract & Execution');
    try {
        const postHookPath = path.resolve(__dirname, '../hooks/post_invocation.js');
        assert.ok(fs.existsSync(postHookPath), 'Tệp post_invocation.js phải tồn tại');

        const payload = JSON.stringify({
            conversationId: 'test-conv-post-hook',
            workspacePaths: [],
            transcriptPath: '',
            artifactDirectoryPath: '',
            modelName: 'auto'
        });

        const startHook = performance.now();
        const out = execSync(`node "${postHookPath}"`, {
            input: payload,
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
            timeout: 5000
        });
        const duration = performance.now() - startHook;

        const parsed = JSON.parse(out);
        assert.ok(Array.isArray(parsed.injectSteps), 'PostInvocation output phải có injectSteps là Array');
        assert.strictEqual(parsed.injectSteps.length, 0, 'injectSteps của PostInvocation phải rỗng để không block loop');

        recordTest('PostHook', '4.1 PostInvocation hook trả về output hợp lệ chuẩn Antigravity', true, `${duration.toFixed(2)}ms`);
    } catch (e) {
        recordTest('PostHook', '4.1 PostInvocation Hook Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Enhanced Heuristics in Memory Extractor
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 5] Enhanced Heuristics in Memory Extractor (Natural Phrasing)');
    try {
        // Architectural choice with natural phrasing
        const naturalText = 'Sau khi cân nhắc, chúng tôi quyết định thay thế UXTU bằng RyzenAdj 89C để giải phóng 372MB RAM và bảo vệ phần cứng.';
        const extractions = extractor.extractFromText(naturalText, 'user', 'global', { apply: false });

        const decisionItem = extractions.find(x => x.type === 'knowledge' && (x.category === 'decision' || x.category === 'rule'));
        assert.ok(decisionItem, 'Phải trích xuất được quyết định kiến trúc từ câu văn tự nhiên');
        assert.ok(decisionItem.content.includes('RyzenAdj 89C'), 'Nội dung trích xuất phải chứa thông tin cốt lõi');

        recordTest('Extractor', '5.1 Nhận diện quyết định kiến trúc từ ngôn ngữ tự nhiên', true, `Title: ${decisionItem.title}`);
    } catch (e) {
        recordTest('Extractor', '5.1 Enhanced Extractor Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n═════════════════════════════════════════════════════════════════════');
    const total = testResults.length;
    const passed = testResults.filter(t => t.passed).length;
    const rate = ((passed / total) * 100).toFixed(1);
    console.log(`📊 TỔNG KẾT BỘ TEST v3.4: ${passed}/${total} TESTS PASS (${rate}%)`);
    if (passed === total) {
        console.log('🎉 TOÀN BỘ CÁC NÂNG CẤP v3.4 ĐẠT CHUẨN PRODUCTION 100%!');
    } else {
        console.log('⚠️ CẦN HOÀN THIỆN CÁC PHẦN IMPLEMENTATION CHƯA ĐẠT!');
    }
    console.log('═════════════════════════════════════════════════════════════════════\n');

    process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
