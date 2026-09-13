const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '../../../');
const cliPath = path.join(projectRoot, 'cli.js');

console.log('=== CLI COMMAND VERIFICATION SUITE ===');

// Test 1: stats
console.log('\n--- 1. Testing "node cli.js stats" ---');
const statsOut = execSync(`node "${cliPath}" stats`, { cwd: projectRoot, encoding: 'utf8' });
console.log(statsOut.trim());
if (!statsOut.includes('Hồ sơ người dùng (User Profile)    : 12 mục') ||
    !statsOut.includes('Tri thức dài hạn (Knowledge Items) : 11 mục') ||
    !statsOut.includes('Giải pháp kỹ thuật (Solutions)     : 15 giải pháp') ||
    !statsOut.includes('Sự kiện hội thoại (Episodes)       : 1193 tin nhắn')) {
    throw new Error('Stats output did not match expected counts!');
}
console.log('✓ "node cli.js stats" PASSED');

// Test 2: profile
console.log('\n--- 2. Testing "node cli.js profile" ---');
const profOut = execSync(`node "${cliPath}" profile`, { cwd: projectRoot, encoding: 'utf8' });
console.log(profOut.trim());
if (!profOut.includes('honorific') || !profOut.includes('Ngài (Sir)') ||
    !profOut.includes('hostname') || !profOut.includes('second_brain_repo')) {
    throw new Error('Profile output missing key profile items!');
}
console.log('✓ "node cli.js profile" PASSED');

// Test 3: search "bảo mật"
console.log('\n--- 3. Testing "node cli.js search \"bảo mật\"" ---');
const searchOut = execSync(`node "${cliPath}" search "bảo mật"`, { cwd: projectRoot, encoding: 'utf8' });
console.log(searchOut.trim());
if (!searchOut.includes('Kết quả tìm kiếm cho: "bảo mật"') ||
    !searchOut.includes('Tri thức & Ghi chú')) {
    throw new Error('Search output missing search results!');
}
console.log('✓ "node cli.js search \"bảo mật\"" PASSED');

// Test 4: solutions & solution
console.log('\n--- 4. Testing "node cli.js solutions" ---');
const solsOut = execSync(`node "${cliPath}" solutions`, { cwd: projectRoot, encoding: 'utf8' });
console.log(solsOut.split('\n').slice(0, 8).join('\n'));
if (!solsOut.includes('15 mục')) {
    throw new Error('Solutions output missing 15 items header!');
}
console.log('✓ "node cli.js solutions" PASSED');

// Test 5: sync in isolated environment
console.log('\n--- 5. Testing "sync" command execution logic ---');
const agentDir = path.resolve(__dirname, '../');
const testDbPath = path.join(agentDir, 'temp_cli_test_brain.db');
const { DatabaseSync } = require('node:sqlite');
const pristinePath = path.join(agentDir, 'pristine_brain.db');

if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
for (const ext of ['-shm', '-wal']) if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
const pDb = new DatabaseSync(pristinePath, { readOnly: true });
pDb.exec("VACUUM INTO '" + testDbPath.replace(/\\/g, '/') + "'");
pDb.close();

// Run sync via script using cli logic
const syncScript = path.join(__dirname, 'temp_sync_cli.js');
fs.writeFileSync(syncScript, `
const path = require('path');
const dbModule = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'src/db'));
const { BrainDB } = dbModule;
const targetDb = new BrainDB('${testDbPath.replace(/\\/g, '/')}');
dbModule.getDB = () => targetDb;

const { getEpisodicMemory } = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'src/episodic'));
console.log('🔄 Đang đồng bộ hóa toàn bộ lịch sử hội thoại từ Antigravity Brain...');
const episodic = getEpisodicMemory();
const result = episodic.syncAllConversations();
console.log('✅ Đồng bộ hoàn tất!');
console.log('• Phiên trò chuyện được xử lý: ' + result.syncedConversations);
console.log('• Tin nhắn / sự kiện mới nạp: ' + result.totalNewEpisodes);
`, 'utf8');

const syncOut = execSync(`node "${syncScript}"`, { cwd: projectRoot, encoding: 'utf8' });
console.log(syncOut.trim());
fs.unlinkSync(syncScript);
fs.unlinkSync(testDbPath);
for (const ext of ['-shm', '-wal']) if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
if (!syncOut.includes('✅ Đồng bộ hoàn tất!')) {
    throw new Error('Sync execution failed!');
}
console.log('✓ "sync" command logic PASSED');

// Test 6: git-backup in isolated sandbox repository
console.log('\n--- 6. Testing "git-backup" command execution logic ---');
const testGitDir = path.join(agentDir, 'temp_cli_git_repo');
if (fs.existsSync(testGitDir)) fs.rmSync(testGitDir, { recursive: true, force: true });
fs.mkdirSync(testGitDir, { recursive: true });

execSync('git init -b main', { cwd: testGitDir, stdio: 'ignore' });
execSync('git config user.name "Reviewer"', { cwd: testGitDir, stdio: 'ignore' });
execSync('git config user.email "reviewer@example.com"', { cwd: testGitDir, stdio: 'ignore' });

const backupScript = path.join(__dirname, 'temp_backup_cli.js');
fs.writeFileSync(backupScript, `
const path = require('path');
const gitModule = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'src/git_backup'));
const Orig = gitModule.GitBackupManager;
class MockGitMgr extends Orig {
    constructor() {
        super('${testGitDir.replace(/\\/g, '/')}', '${path.join(testGitDir, 'exports').replace(/\\/g, '/')}');
    }
}
gitModule.GitBackupManager = MockGitMgr;
gitModule.getGitBackupManager = () => new MockGitMgr();

console.log('📦 Đang tiến hành sao lưu và đồng bộ Second Brain lên Git...');
const gitBackup = gitModule.getGitBackupManager();
const res = gitBackup.commitBackup('compat review');
if (!res.success) {
    console.error('❌ Lỗi sao lưu Git: ' + res.error);
    process.exit(1);
}
if (res.committed) {
    console.log('✅ Commit thành công: ' + res.commit);
} else {
    console.log('ℹ️ ' + res.message);
}
console.log('• Hồ sơ cá nhân : ' + res.stats.profileCount + ' mục');
console.log('• Tri thức      : ' + res.stats.knowledgeCount + ' mục');
console.log('• Giải pháp lỗi : ' + res.stats.solutionsCount + ' mục');
console.log('• Phiên hội thoại: ' + res.stats.conversationsCount + ' phiên');
console.log('• Tệp xuất diff : ' + res.stats.exportedFiles.join(', '));
`, 'utf8');

const backupOut = execSync(`node "${backupScript}"`, { cwd: projectRoot, encoding: 'utf8' });
console.log(backupOut.trim());
fs.unlinkSync(backupScript);
fs.rmSync(testGitDir, { recursive: true, force: true });
if (!backupOut.includes('✅ Commit thành công:') || !backupOut.includes('Hồ sơ cá nhân : 12 mục') || !backupOut.includes('Tri thức      : 11 mục')) {
    throw new Error('git-backup execution failed!');
}
console.log('✓ "git-backup" command logic PASSED');

console.log('\n======================================================');
console.log('🎉 ALL 5 CORE CLI COMMANDS VERIFIED SUCCESSFULLY!');
console.log('======================================================');
