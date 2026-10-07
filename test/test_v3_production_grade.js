// ==============================================================================
// Antigravity Second Brain: v3.0 Production-Grade Verification Suite
// Verifies Dynamic Relevance Cutoff, Bi-Temporal Knowledge Graph,
// Active Self-Editing Memory MCP Tools, and Executive Session Distillation
// ==============================================================================

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

const SECOND_BRAIN_DIR = path.join(__dirname, '..');
const { getDB } = require('../src/db');
const { getSemanticKnowledge } = require('../src/semantic');
const { getContextRetriever } = require('../src/retriever');
const { getMemoryConsolidator } = require('../src/consolidation');
const { getProfileManager } = require('../src/profile');
const { getSolutionStore } = require('../src/solutions');

const testResults = [];

function recordTest(suite, name, passed, details = '') {
    testResults.push({ suite, name, passed, details });
    const mark = passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`  ${mark} ${name}${details ? ` (${details})` : ''}`);
}

async function runTests() {
    console.log('═════════════════════════════════════════════════════════════════════');
    console.log('🚀 ANTIGRAVITY SECOND BRAIN v3.0 — PRODUCTION-GRADE TEST SUITE');
    console.log('═════════════════════════════════════════════════════════════════════\n');

    const db = getDB();

    // -------------------------------------------------------------------------
    // TEST 1: Dynamic Relevance Cutoff (Casual Query Prompt Optimization)
    // -------------------------------------------------------------------------
    console.log('👉 [TEST 1] Dynamic Relevance Cutoff (Casual Query vs Technical Query)');
    try {
        const retriever = getContextRetriever(db);

        // 1.1 Casual greeting query
        const casualPrompt = await retriever.compileContext('chào buổi sáng');
        assert.ok(!casualPrompt.includes('[TRI THỨC & QUY TẮC PHÙ HỢP]'), 'Chào hỏi không được tiêm danh sách tri thức không liên quan');
        assert.ok(casualPrompt.includes('[HỒ SƠ CỐT LÕI CỦA NGÀI]'), 'Chào hỏi vẫn phải giữ hồ sơ của Ngài');
        assert.ok(casualPrompt.includes('Ngài (Sir)'), 'Chào hỏi phải giữ thuộc tính danh xưng của Ngài');

        // 1.2 Technical query
        const techPrompt = await retriever.compileContext('lệnh temp kiểm tra nhiệt độ cpu gpu');
        assert.ok(techPrompt.includes('[TRI THỨC & QUY TẮC PHÙ HỢP]'), 'Truy vấn kỹ thuật phải tiêm tri thức liên quan');
        assert.ok(techPrompt.toLowerCase().includes('temp'), 'Phải chứa nội dung về temp');

        // Prompt size comparison
        const casualSize = casualPrompt.length;
        const techSize = techPrompt.length;
        assert.ok(casualSize < techSize, `Kích thước prompt chào hỏi (${casualSize}) phải nhỏ hơn truy vấn kỹ thuật (${techSize})`);

        recordTest('Point 1: Cutoff', '1.1 Casual greeting lọc bỏ tri thức rác (Zero Token Waste)', true, `Size: ${casualSize} chars`);
        recordTest('Point 1: Cutoff', '1.2 Technical query tiêm đầy đủ ngữ cảnh chính xác cao', true, `Size: ${techSize} chars`);
    } catch (e) {
        recordTest('Point 1: Cutoff', '1.1 Dynamic Cutoff Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Breakthrough 1 - Bi-Temporal Knowledge Graph & SQLite Recursive CTE
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 2] Breakthrough 1 — Bi-Temporal Knowledge Graph & Recursive CTE');
    try {
        const semantic = getSemanticKnowledge(db);

        // 2.1 Check schema columns
        const cols = db.all('PRAGMA table_info(entity_relations)').map(c => c.name);
        assert.ok(cols.includes('valid_from'), 'Bảng entity_relations phải có cột valid_from');
        assert.ok(cols.includes('valid_until'), 'Bảng entity_relations phải có cột valid_until');
        assert.ok(cols.includes('metadata'), 'Bảng entity_relations phải có cột metadata');

        // 2.2 2-Hop Recursive CTE Traversal Performance (< 15ms)
        const t0 = performance.now();
        const relations = semantic.getRelationsForEntity('Ngài', 2);
        const latency = (performance.now() - t0).toFixed(2);
        assert.ok(relations.length >= 8, `Phải có ít nhất 8 quan hệ từ Ngài (hiện tại: ${relations.length})`);
        assert.ok(Number(latency) < 15, `Độ trễ truy vấn Recursive CTE phải < 15ms (thực tế: ${latency}ms)`);

        // 2.3 Bi-Temporal Superseding & Expiration
        semantic.addRelation('TestEntity', 'prefers', 'OldChoice', { confidence: 0.9 });
        const activeBefore = semantic.getRelationsForEntity('TestEntity', 1);
        assert.strictEqual(activeBefore[0].target_entity, 'OldChoice');

        // Supersede with NewChoice
        semantic.addRelation('TestEntity', 'prefers', 'NewChoice', { confidence: 1.0 });
        const activeAfter = semantic.getRelationsForEntity('TestEntity', 1, false);
        assert.strictEqual(activeAfter.length, 1, 'Chỉ 1 quan hệ còn hiệu lực');
        assert.strictEqual(activeAfter[0].target_entity, 'NewChoice');

        // Check expired relation in historical query
        const allHistory = semantic.getRelationsForEntity('TestEntity', 1, true);
        assert.strictEqual(allHistory.length, 2, 'Lịch sử phải giữ cả 2 bản ghi');
        const oldRel = allHistory.find(r => r.target_entity === 'OldChoice');
        assert.ok(oldRel.valid_until !== null, 'Quan hệ cũ phải có valid_until');

        // Cleanup test entity
        db.run("DELETE FROM entity_relations WHERE source_entity = 'TestEntity'");

        recordTest('Breakthrough 1: Graph', '2.1 Bi-Temporal Schema Columns (valid_from, valid_until, metadata)', true);
        recordTest('Breakthrough 1: Graph', '2.2 SQLite Recursive CTE 2-hop Traversal cực nhanh', true, `Latency: ${latency}ms, Rels: ${relations.length}`);
        recordTest('Breakthrough 1: Graph', '2.3 Tự động vô hiệu hóa quan hệ cũ khi có mâu thuẫn (Auto-supersede)', true);
    } catch (e) {
        recordTest('Breakthrough 1: Graph', '2.1 Graph & Temporal Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Breakthrough 2 - Active Tool-Driven Self-Editing Memory (Letta Paradigm)
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 3] Breakthrough 2 — Active Tool-Driven Self-Editing Memory (MCP Tools)');
    try {
        const serverPath = path.join(SECOND_BRAIN_DIR, 'mcp_server.js');
        const child = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'ignore'] });

        let output = '';
        child.stdout.on('data', d => { output += d.toString(); });

        const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');

        // 1. Initialize
        send({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
        });

        // 2. List tools
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

        // 3. Call brain_remember
        send({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'brain_remember',
                arguments: {
                    text: 'test_mcp_remember_val',
                    key: 'test_mcp_remember_key',
                    category: 'preference'
                }
            }
        });

        // 4. Call brain_learn_fix
        send({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'brain_learn_fix',
                arguments: {
                    error_pattern: 'TestError: connection timeout',
                    solution_code: 'Increase timeout to 10000ms',
                    command_fix: 'npm test -- --timeout=10000',
                    project_scope: 'test'
                }
            }
        });

        // 5. Call brain_forget
        send({
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
                name: 'brain_forget',
                arguments: {
                    key: 'test_mcp_remember_key',
                    reason: 'test cleanup'
                }
            }
        });

        await new Promise(r => setTimeout(r, 2000));
        child.kill();

        const lines = output.trim().split('\n').filter(l => l.trim().startsWith('{'));
        const responses = {};
        for (const l of lines) {
            try {
                const p = JSON.parse(l);
                if (p.id) responses[p.id] = p;
            } catch (err) {}
        }

        // Verify tools/list contains 14 tools
        assert.ok(responses[2] && responses[2].result && responses[2].result.tools, 'tools/list phải trả về danh sách tools');
        const toolNames = responses[2].result.tools.map(t => t.name);
        assert.strictEqual(toolNames.length, 14, `Tổng số MCP tools phải là 14 (hiện tại: ${toolNames.length})`);
        assert.ok(toolNames.includes('brain_remember'), 'Phải có tool brain_remember');
        assert.ok(toolNames.includes('brain_forget'), 'Phải có tool brain_forget');
        assert.ok(toolNames.includes('brain_learn_fix'), 'Phải có tool brain_learn_fix');

        // Verify brain_remember call
        assert.ok(responses[3] && responses[3].result, 'brain_remember phải thực thi thành công');
        assert.ok(responses[3].result.content[0].text.includes('test_mcp_remember_key'), 'brain_remember phải xác nhận đã lưu');

        // Verify brain_learn_fix call
        assert.ok(responses[4] && responses[4].result, 'brain_learn_fix phải thực thi thành công');
        assert.ok(responses[4].result.content[0].text.includes('TestError: connection timeout'), 'brain_learn_fix phải xác nhận ghi nhớ giải pháp');

        // Verify brain_forget call
        assert.ok(responses[5] && responses[5].result, 'brain_forget phải thực thi thành công');
        assert.ok(responses[5].result.content[0].text.includes('test_mcp_remember_key'), 'brain_forget phải xác nhận đã xóa/quên');

        // Clean up test solution
        db.run("DELETE FROM solutions WHERE project_scope = 'test'");

        recordTest('Breakthrough 2: Active Tools', '3.1 MCP Server đăng ký đủ 14 công cụ chuẩn RFC', true, '14 tools registered');
        recordTest('Breakthrough 2: Active Tools', '3.2 Tool brain_remember ghi nhớ tức thì theo thời gian thực', true);
        recordTest('Breakthrough 2: Active Tools', '3.3 Tool brain_learn_fix tự động cập nhật Procedural Memory', true);
        recordTest('Breakthrough 2: Active Tools', '3.4 Tool brain_forget thu hồi/vô hiệu hóa tri thức an toàn', true);
    } catch (e) {
        recordTest('Breakthrough 2: Active Tools', '3.1 MCP Active Tools Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Breakthrough 3 - Autonomous Executive Session Distiller
    // -------------------------------------------------------------------------
    console.log('\n👉 [TEST 4] Breakthrough 3 — Autonomous Executive Session Distiller & Consolidation');
    try {
        const consolidator = getMemoryConsolidator(db);

        // 4.1 Check structured format on distilled conversation
        const sampleConv = db.get("SELECT id, summary, key_takeaways FROM conversations WHERE summary LIKE '[Mục tiêu:%' LIMIT 1");
        assert.ok(sampleConv, 'Phải có ít nhất 1 phiên đã được distill có cấu trúc');
        assert.ok(sampleConv.summary.includes('[Mục tiêu:'), 'Summary phải có trường [Mục tiêu:');
        
        // Check takeaways JSON
        const parsedTakeaways = JSON.parse(sampleConv.key_takeaways);
        assert.ok(parsedTakeaways.goal, 'key_takeaways phải có trường goal');
        assert.ok(Array.isArray(parsedTakeaways.decisions), 'key_takeaways phải có decisions array');
        assert.ok(Array.isArray(parsedTakeaways.files), 'key_takeaways phải có files array');
        assert.ok(parsedTakeaways.distilled_at, 'key_takeaways phải có timestamp distilled_at');

        // 4.2 CLI graph command execution
        const graphRes = spawnSync('node', ['cli.js', 'graph', 'Ngài'], { cwd: SECOND_BRAIN_DIR, encoding: 'utf8' });
        assert.strictEqual(graphRes.status, 0, 'CLI graph phải chạy thành công (exit 0)');
        assert.ok(graphRes.stdout.includes('BẢN ĐỒ TRI THỨC ĐỒ THỊ'), 'CLI graph phải in tiêu đề bản đồ đồ thị');
        assert.ok(graphRes.stdout.includes('Hiệu lực'), 'CLI graph phải hiển thị trạng thái hiệu lực');

        // 4.3 CLI summarize command execution
        const sumRes = spawnSync('node', ['cli.js', 'summarize', sampleConv.id], { cwd: SECOND_BRAIN_DIR, encoding: 'utf8' });
        assert.strictEqual(sumRes.status, 0, 'CLI summarize phải chạy thành công (exit 0)');
        assert.ok(sumRes.stdout.includes('Chắt lọc thành công!'), 'CLI summarize phải thông báo thành công');

        recordTest('Breakthrough 3: Distiller', '4.1 Executive Distillation sinh cấu trúc [Goal | Decisions | Files | Learned]', true);
        recordTest('Breakthrough 3: Distiller', '4.2 key_takeaways lưu trữ JSON schema chuẩn xác', true);
        recordTest('Breakthrough 3: Distiller', '4.3 CLI command: brain graph hiển thị ASCII Tree 2-hop', true);
        recordTest('Breakthrough 3: Distiller', '4.4 CLI command: brain summarize chắt lọc theo yêu cầu', true);
    } catch (e) {
        recordTest('Breakthrough 3: Distiller', '4.1 Distiller Test', false, e.message);
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n═════════════════════════════════════════════════════════════════════');
    const total = testResults.length;
    const passed = testResults.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`📊 TỔNG KẾT NGHIỆM THU v3.0: ${passed}/${total} TESTS PASS (${((passed/total)*100).toFixed(1)}%)`);
    if (failed === 0) {
        console.log('🎉 TOÀN BỘ CẢ 3 ĐỘT PHÁ SOTA ĐÃ HOÀN TẤT & ĐẠT CHUẨN PRODUCTION 100%!');
    } else {
        console.log(`⚠️ Có ${failed} bài kiểm thử chưa đạt, kính đề nghị kiểm tra lại.`);
    }
    console.log('═════════════════════════════════════════════════════════════════════\n');
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
