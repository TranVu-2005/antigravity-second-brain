// ==============================================================================
// Antigravity Second Brain: Comprehensive Automated Test Suite
// ==============================================================================

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { BrainDB } = require('../src/db');
const { ProfileManager } = require('../src/profile');
const { SemanticKnowledge } = require('../src/semantic');
const { EpisodicMemory } = require('../src/episodic');
const { MemoryExtractor } = require('../src/extractor');
const { ContextRetriever } = require('../src/retriever');

const TEST_DB_PATH = path.join(__dirname, 'test_brain.db');

function cleanup() {
    for (const f of [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]) {
        if (fs.existsSync(f)) {
            try { fs.unlinkSync(f); } catch (e) {}
        }
    }
}

async function runTests() {
    console.log('🧪 Bắt đầu kiểm thử toàn diện hệ thống Second Brain...\n');
    cleanup();

    const db = new BrainDB(TEST_DB_PATH);

    // Test 1: SQLite Schema & Pragmas
    console.log('Test 1: Kiểm tra cấu trúc CSDL và SQLite Pragmas');
    const journalMode = db.get('PRAGMA journal_mode;').journal_mode;
    assert.strictEqual(journalMode.toLowerCase(), 'wal', 'Journal mode phải là WAL');
    console.log('  ✓ CSDL hoạt động ở chế độ WAL chuẩn xác');

    // Test 2: Profile Manager (Tier 0)
    console.log('Test 2: Kiểm tra Tier 0 - Core Identity & Profile');
    const profile = new ProfileManager(db);
    const initialFacts = profile.getAll();
    assert.ok(initialFacts.length > 0, 'Phải có các facts ban đầu');
    const honorific = profile.get('honorific');
    assert.strictEqual(honorific, 'Ngài (Sir)');
    
    // Set custom fact
    profile.setFact('favorite_framework', 'Node.js', 'tech_stack');
    assert.strictEqual(profile.get('favorite_framework'), 'Node.js');
    console.log('  ✓ Quản lý hồ sơ cá nhân của Ngài hoạt động hoàn hảo');

    // Test 3: Semantic Knowledge & Hybrid Search (Tier 3)
    console.log('Test 3: Kiểm tra Tier 3 - Semantic Knowledge & FTS5 BM25 Search');
    const semantic = new SemanticKnowledge(db);
    const id = await semantic.addItem({
        title: 'Quy chuẩn bảo mật Token',
        content: 'Tuyệt đối không hardcode API key vào git repository.',
        category: 'decision',
        tags: 'security,token,git',
        importance: 1.8
    });
    assert.ok(id > 0, 'Phải tạo thành công item ID');

    // Search using BM25 FTS5
    const results = await semantic.searchKnowledge('bảo mật Token');
    assert.ok(results.length > 0, 'FTS5 phải tìm thấy kết quả bảo mật Token');
    assert.ok(results[0].score > 0, 'Phải tính được điểm Hybrid Score');
    console.log(`  ✓ FTS5 BM25 Hybrid Search thành công (Score: ${results[0].score})`);

    // Test 4: Knowledge Graph (Tier 3.5)
    console.log('Test 4: Kiểm tra Entity & Knowledge Graph');
    semantic.addRelation('Ngài', 'builds', 'Second Brain');
    const relations = semantic.getRelationsForEntity('Ngài');
    assert.ok(relations.some(r => r.relation === 'builds'), 'Phải lưu được quan hệ Ngài -> builds -> Second Brain');
    console.log('  ✓ Graph quan hệ thực thể hoạt động chính xác');

    // Test 5: Extractor (Tier 4)
    console.log('Test 5: Kiểm tra Tier 4 - Autonomous Extraction Engine');
    const extractor = new MemoryExtractor(profile, semantic);
    const extracted = extractor.extractFromText('Từ nay hãy luôn giải thích cặn kẽ thuật toán cho tôi');
    assert.ok(extracted.length > 0, 'Extractor phải bắt được chỉ thị');
    console.log(`  ✓ Trích xuất tự động thành công: ${extracted[0].title}`);

    // Test 6: Episodic Memory (Tier 2)
    console.log('Test 6: Kiểm tra Tier 2 - Episodic Memory & Sync');
    const episodic = new EpisodicMemory(db);
    const syncRes = episodic.syncAllConversations();
    console.log(`  ✓ Đã đồng bộ ${syncRes.syncedConversations} phiên làm việc với ${syncRes.totalNewEpisodes} sự kiện`);

    // Test 7: Context Retriever
    console.log('Test 7: Kiểm tra Context Compiler cho PreInvocation Hook');
    const retriever = new ContextRetriever();
    const compiled = await retriever.compileContext('thời tiết hoàng mai', null, { workspacePaths: ['C:/Workspace/Alpha'] });
    assert.ok(compiled.includes('[HỒ SƠ CỐT LÕI CỦA NGÀI]'), 'Context phải chứa hồ sơ của Ngài');
    assert.ok(compiled.includes('[DỰ ÁN HIỆN TẠI: Alpha]'), 'Context phải chứa project scope');
    console.log('  ✓ Context Compiler biên dịch ngữ cảnh thành công với Project Scope');

    // Test 8: Procedural Memory (SolutionStore)
    console.log('Test 8: Kiểm tra Tier 4 - Procedural Memory & Bug Solution Store');
    const { SolutionStore } = require('../src/solutions');
    const solStore = new SolutionStore(db);
    const solId = solStore.addSolution({
        error_pattern: 'EADDRINUSE: port 3000 already in use',
        root_cause: 'Previous process did not terminate properly',
        solution_code: 'Kill process on port 3000 using Stop-Process or netstat',
        command_fix: 'npx kill-port 3000',
        project_scope: 'Alpha',
        tags: 'network,port,node'
    });
    assert.ok(solId > 0, 'Phải tạo thành công solution ID');
    const foundSols = solStore.searchSolutions('port 3000 in use', { project_scope: 'Alpha' });
    assert.ok(foundSols.length > 0, 'FTS5 phải tìm thấy giải pháp port 3000');
    console.log('  ✓ Procedural Memory tìm thấy giải pháp sửa lỗi thành công');

    // Test 9: Token-Budgeted Context Compression
    console.log('Test 9: Kiểm tra Token-Budgeted Context Compression');
    const compiledTroubleshoot = await retriever.compileContext('cách sửa lỗi powershell quotes', null, { maxTokens: 400 });
    assert.ok(compiledTroubleshoot.includes('PROCEDURAL'), 'Context phải nạp Procedural Memory khi gặp lỗi');
    assert.ok(compiledTroubleshoot.length < 400 * 4, 'Context không được vượt quá ngân sách token');
    console.log(`  ✓ Context Compressor nén tối ưu (Độ dài: ${compiledTroubleshoot.length} ký tự, < 1600 budget)`);

    db.close();
    cleanup();
    console.log('\n🎉 TẤT CẢ 9 BÀI TEST v2.0 ĐỀU VƯỢT QUA XUẤT SẮC (100% PASS)!');
}

runTests().catch(err => {
    console.error('❌ Test thất bại:', err);
    process.exit(1);
});
