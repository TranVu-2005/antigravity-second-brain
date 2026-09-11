#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: CLI Administration & Synchronization Tool
// ==============================================================================

const { exec } = require('node:child_process');
const path = require('node:path');
const { getDB } = require('./src/db');
const { getProfileManager } = require('./src/profile');
const { getSemanticKnowledge } = require('./src/semantic');
const { getEpisodicMemory } = require('./src/episodic');
const { getBackupManager } = require('./src/backup');
const { getMemoryConsolidator } = require('./src/consolidation');
const { getSolutionStore } = require('./src/solutions');
const { getGitBackupManager } = require('./src/git_backup');

const args = process.argv.slice(2);
const command = args[0] || 'help';

function printHelp() {
    console.log(`
===================================================================
🧠 ANTIGRAVITY SECOND BRAIN CLI v2.0 (Kính phục vụ Ngài)
===================================================================
Lệnh khả dụng:
  sync                 Đồng bộ toàn bộ lịch sử transcript từ Antigravity brain
  stats                Xem thống kê cơ sở dữ liệu và bộ nhớ
  search <query>       Tìm kiếm kiến thức và lịch sử trò chuyện
  solutions            Xem các giải pháp kỹ thuật đã học (Procedural Memory)
  solution <error>     Tìm kiếm cách fix lỗi kỹ thuật cụ thể
  profile              Xem hồ sơ cốt lõi của Ngài
  store <title> <text> Lưu nhanh một ghi chú kiến thức mới
  backup               Tạo bản sao lưu nóng an toàn ngay lập tức
  backups              Xem danh sách các bản sao lưu đã tạo
  compact              Tinh biến bộ nhớ, dọn dẹp và tối ưu hóa index
  dashboard            Mở giao diện trực quan Visual Dashboard trên trình duyệt
  git-backup [msg]     Sao lưu dữ liệu, xuất text diff và commit lên Git
  git-status           Xem trạng thái Git repo và kết nối Remote
  git-remote <url>     Cấu hình địa chỉ Remote Repository (GitHub/GitLab)
  git-push             Đẩy toàn bộ commit lên Remote Repository
  help                 Hiển thị hướng dẫn này
===================================================================
`);
}

async function main() {
    switch (command) {
        case 'sync': {
            console.log('🔄 Đang đồng bộ hóa toàn bộ lịch sử hội thoại từ Antigravity Brain...');
            const episodic = getEpisodicMemory();
            const result = episodic.syncAllConversations();
            console.log(`✅ Đồng bộ hoàn tất!`);
            console.log(`• Phiên trò chuyện được xử lý: ${result.syncedConversations}`);
            console.log(`• Tin nhắn / sự kiện mới nạp: ${result.totalNewEpisodes}`);
            break;
        }

        case 'stats': {
            const db = getDB();
            const knCount = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
            const epCount = db.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
            const convCount = db.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
            const profCount = db.get('SELECT COUNT(*) as cnt FROM user_profile').cnt;
            const solCount = db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;
            const backups = getBackupManager().listBackups();

            console.log(`
📊 ANTIGRAVITY SECOND BRAIN - BÁO CÁO THỐNG KÊ (v2.0)
--------------------------------------------------
• Hồ sơ người dùng (User Profile)    : ${profCount} mục
• Tri thức dài hạn (Knowledge Items) : ${knCount} mục
• Giải pháp kỹ thuật (Solutions)     : ${solCount} giải pháp
• Sự kiện hội thoại (Episodes)       : ${epCount} tin nhắn
• Phiên hội thoại (Conversations)    : ${convCount} phiên
• Bản sao lưu an toàn (Snapshots)    : ${backups.length} bản
• Vị trí CSDL                        : brain.db (SQLite WAL Mode)
--------------------------------------------------
Sẵn sàng phục vụ Ngài với hiệu năng tối ưu!
`);
            break;
        }

        case 'profile': {
            const profile = getProfileManager();
            const facts = profile.getAll();
            console.log(`\n👑 HỒ SƠ CỐT LÕI CỦA NGÀI:\n`);
            for (const f of facts) {
                console.log(`  [${f.category}] ${f.key.padEnd(20)}: ${f.value}`);
            }
            console.log('');
            break;
        }

        case 'search': {
            const query = args.slice(1).join(' ');
            if (!query) {
                console.log('Vui lòng nhập từ khóa tìm kiếm: brain search <query>');
                return;
            }
            console.log(`🔍 Kết quả tìm kiếm cho: "${query}"\n`);
            const semantic = getSemanticKnowledge();
            const episodic = getEpisodicMemory();

            const kn = semantic.searchKnowledge(query, { limit: 3 });
            if (kn.length > 0) {
                console.log('--- Tri thức & Ghi chú ---');
                for (const k of kn) {
                    console.log(`• [#${k.id} | ${k.category.toUpperCase()}] ${k.title} (Score: ${k.score})`);
                    console.log(`  ${k.content.slice(0, 150)}...\n`);
                }
            }

            const ep = episodic.searchEpisodes(query, 3);
            if (ep.length > 0) {
                console.log('--- Lịch sử hội thoại ---');
                for (const e of ep) {
                    console.log(`• [${e.timestamp.split('T')[0]}] [${e.conv_title || 'Phiên làm việc'}] ${e.role}: ${e.summary}`);
                }
            }
            break;
        }

        case 'solutions': {
            const solStore = getSolutionStore();
            const list = solStore.getAll();
            console.log(`\n🛠️ BỘ NHỚ GIẢI PHÁP KỸ THUẬT (PROCEDURAL MEMORY - ${list.length} mục):\n`);
            for (const s of list) {
                console.log(`• [#${s.id}] Lỗi: "${s.error_pattern}"`);
                console.log(`  Nguyên nhân: ${s.root_cause || 'N/A'}`);
                console.log(`  Giải pháp  : ${s.solution_code}`);
                if (s.command_fix) console.log(`  Lệnh fix   : ${s.command_fix}`);
                console.log(`  (Phạm vi: ${s.project_scope} | Tự tin: ${s.confidence * 100}% | Đã sửa: ${s.success_count} lần)\n`);
            }
            break;
        }

        case 'solution': {
            const query = args.slice(1).join(' ');
            if (!query) {
                console.log('Cú pháp: brain solution <mô_tả_lỗi>');
                return;
            }
            const solStore = getSolutionStore();
            const results = solStore.searchSolutions(query);
            console.log(`\n🔍 TÌM THẤY ${results.length} GIẢI PHÁP PHÙ HỢP:\n`);
            for (const s of results) {
                console.log(`• Lỗi: "${s.error_pattern}"`);
                console.log(`  ➔ Cách sửa: ${s.solution_code}`);
                if (s.command_fix) console.log(`  ➔ Lệnh: ${s.command_fix}`);
                console.log('');
            }
            break;
        }

        case 'store': {
            const title = args[1];
            const content = args.slice(2).join(' ');
            if (!title || !content) {
                console.log('Cú pháp: brain store <tiêu_đề> <nội_dung>');
                return;
            }
            const semantic = getSemanticKnowledge();
            const id = semantic.addItem({
                title,
                content,
                category: 'note',
                tags: 'cli',
                source: 'cli',
                importance: 1.2
            });
            console.log(`✅ Đã lưu mục kiến thức thành công với ID #${id}`);
            break;
        }

        case 'backup': {
            console.log('💾 Đang tạo bản sao lưu an toàn của Second Brain...');
            const backupMgr = getBackupManager();
            const res = backupMgr.createBackup();
            if (res.success) {
                console.log(`✅ Bản sao lưu đã được tạo thành công!`);
                console.log(`• Tên tệp: ${res.fileName}`);
                console.log(`• Dung lượng: ${(res.sizeBytes / 1024).toFixed(1)} KB`);
                console.log(`• Vị trí: ${res.filePath}`);
            } else {
                console.error(`❌ Lỗi tạo sao lưu: ${res.error}`);
            }
            break;
        }

        case 'backups': {
            const backupMgr = getBackupManager();
            const list = backupMgr.listBackups();
            console.log(`\n💾 DANH SÁCH BẢN SAO LƯU (${list.length} bản):\n`);
            for (const b of list) {
                console.log(`• ${b.fileName.padEnd(36)} | ${(b.sizeBytes / 1024).toFixed(1).padStart(7)} KB | ${b.createdAt}`);
            }
            console.log('');
            break;
        }

        case 'compact': {
            console.log('🧹 Đang tiến hành tinh biến bộ nhớ & tối ưu hóa CSDL...');
            const consolidator = getMemoryConsolidator();
            const res = consolidator.consolidate();
            console.log(`✅ Tinh biến hoàn tất!`);
            console.log(`• Mục trùng lặp đã gộp: ${res.deduplicatedItems}`);
            console.log(`• Ký ức quá hạn đã dọn: ${res.prunedItems}`);
            console.log(`• Chỉ mục SQLite: ${res.optimized ? 'Đã tối ưu hóa' : 'Bỏ qua'}`);
            break;
        }

        case 'dashboard': {
            const dashPath = path.join(__dirname, 'dashboard.html');
            console.log(`🚀 Đang khởi chạy Interactive Dashboard: ${dashPath}`);
            const startCmd = process.platform === 'win32' ? `start "" "${dashPath}"` : `open "${dashPath}"`;
            exec(startCmd);
            break;
        }

        case 'git-backup': {
            console.log('📦 Đang tiến hành sao lưu và đồng bộ Second Brain lên Git...');
            const gitBackup = getGitBackupManager();
            const msg = args.slice(1).join(' ') || null;
            const res = gitBackup.commitBackup(msg);
            if (!res.success) {
                console.error(`❌ Lỗi sao lưu Git: ${res.error}`);
                break;
            }
            if (res.committed) {
                console.log(`✅ Commit thành công: ${res.commit}`);
            } else {
                console.log(`ℹ️ ${res.message}`);
            }
            console.log(`• Hồ sơ cá nhân : ${res.stats.profileCount} mục`);
            console.log(`• Tri thức      : ${res.stats.knowledgeCount} mục`);
            console.log(`• Giải pháp lỗi : ${res.stats.solutionsCount} mục`);
            console.log(`• Phiên hội thoại: ${res.stats.conversationsCount} phiên`);
            console.log(`• Tệp xuất diff : ${res.stats.exportedFiles.join(', ')}`);

            const status = gitBackup.getStatus();
            if (status.remoteUrl) {
                console.log(`🚀 Đang đẩy dữ liệu lên Remote: ${status.remoteUrl}...`);
                const pushRes = gitBackup.pushRemote();
                if (pushRes.success) {
                    console.log(`✅ Đã đồng bộ lên Remote thành công!`);
                } else {
                    console.log(`⚠️ Chưa thể đẩy lên Remote: ${pushRes.error}`);
                }
            }
            break;
        }

        case 'git-status': {
            const gitBackup = getGitBackupManager();
            const st = gitBackup.getStatus();
            console.log(`\n🐙 TRẠNG THÁI GIT BACKUP SECOND BRAIN:\n`);
            if (!st.gitAvailable) {
                console.log(`❌ Git chưa khả dụng: ${st.error}`);
                break;
            }
            console.log(`• Phiên bản Git    : ${st.version}`);
            console.log(`• Trạng thái Repo  : ${st.initialized ? 'Đã khởi tạo' : 'Chưa khởi tạo'}`);
            if (st.initialized) {
                console.log(`• Nhánh hiện tại   : ${st.branch}`);
                console.log(`• Commit mới nhất  : ${st.lastCommit}`);
                console.log(`• Remote URL       : ${st.remoteUrl || 'Chưa thiết lập (chạy: brain git-remote <url>)'}`);
                console.log(`• Tệp chưa commit  : ${st.uncommittedCount} tệp`);
            } else {
                console.log(`• Gợi ý            : Chạy 'brain git-backup' để khởi tạo và tạo commit đầu tiên.`);
            }
            console.log('');
            break;
        }

        case 'git-remote': {
            const url = args[1];
            if (!url) {
                console.log('Cú pháp: brain git-remote <url>');
                return;
            }
            const gitBackup = getGitBackupManager();
            const res = gitBackup.setRemote(url);
            if (res.success) {
                console.log(`✅ Đã thiết lập Remote URL thành công: ${res.remoteUrl}`);
            } else {
                console.error(`❌ Lỗi thiết lập Remote: ${res.error}`);
            }
            break;
        }

        case 'git-push': {
            console.log('🚀 Đang đẩy dữ liệu lên Remote repository...');
            const gitBackup = getGitBackupManager();
            const res = gitBackup.pushRemote();
            if (res.success) {
                console.log(`✅ ${res.message}`);
            } else {
                console.error(`❌ Lỗi đẩy Remote: ${res.error}`);
            }
            break;
        }

        case 'help':
        default:
            printHelp();
            break;
    }
}

main().catch(err => {
    console.error('Lỗi thực thi:', err.message);
    process.exit(1);
});
