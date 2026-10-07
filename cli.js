#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: CLI Administration & Synchronization Tool
// ==============================================================================

const { spawn } = require('node:child_process');
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
🧠 ANTIGRAVITY SECOND BRAIN CLI v3.8.1 (Production-Grade Cognitive Engine)
===================================================================
Cognitive Memory Administration Commands:
  sync                 Synchronize full interaction transcripts from Antigravity
  stats                Inspect database size, embedding space, and memory tiers
  search <query>       Search across long-term knowledge and conversation history
  solutions            List learned technical solutions from Procedural Memory
  solution <error>     Search solutions for a specific error pattern
  profile              Inspect core user identity and preferences
  graph [entity]       Render ASCII 2-hop Bi-Temporal Knowledge Graph
  summarize [conv_id]  Trigger Executive Session Distillation for conversations
  store <title> <text> Store a quick knowledge note into memory
  backup               Create an immediate hot SQLite backup snapshot
  backups              List all local database snapshots
  compact              Consolidate memory, deduplicate items, and optimize SQLite
  dashboard            Launch real-time interactive Visual Force Graph in browser
  reembed              Recompute 384-dim neural embeddings for all knowledge items
  import-dump [file]   Import and restore database atomically from dump.sql

Decoupled Dual-Repository Management:
  data-status          Inspect Private Data Repository status
  data-backup [msg]    Export clean text diffs and commit to Private Data Repo
  data-pull            Pull latest changes from Private Data Repo and restore DB
  data-push            Push snapshots to remote Private Data Repository on GitHub
  data-sync            Full two-way synchronization (Commit -> Pull -> Push -> Restore)
  data-remote <url>    Configure Git remote URL for Private Data Repository
  engine-status        Inspect Open-Source Engine repository status
  help                 Display this help reference
===================================================================
`);
}

async function main() {
    switch (command) {
        case 'sync': {
            console.log('🔄 Synchronizing conversation transcripts from Antigravity Brain...');
            const episodic = getEpisodicMemory();
            const result = episodic.syncAllConversations();
            console.log(`✅ Synchronization completed!`);
            console.log(`• Sessions processed: ${result.syncedConversations}`);
            console.log(`• New messages ingested: ${result.totalNewEpisodes}`);
            break;
        }

        case 'stats': {
            const fs = require('node:fs');
            const db = getDB();
            const knCount = db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
            const epCount = db.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
            const convCount = db.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
            const profCount = db.get('SELECT COUNT(*) as cnt FROM user_profile').cnt;
            const solCount = db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;
            const backups = getBackupManager().listBackups();
            const embRow = db.get('SELECT length(embedding) as len FROM knowledge_items WHERE embedding IS NOT NULL LIMIT 1');
            const actualDim = (embRow && embRow.len) ? (embRow.len / 4) : 384;
            const dbPath = path.join(__dirname, 'brain.db');
            const dbSize = fs.existsSync(dbPath) ? `${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB` : 'N/A';

            const { getEmbeddingHealth } = require('./src/embedding');
            const embHealth = await getEmbeddingHealth();

            console.log(`
📊 ANTIGRAVITY SECOND BRAIN - OPERATIONAL STATS REPORT (v3.8.1 Hardened)
--------------------------------------------------
• User Profile Attributes    : ${profCount} items
• Long-Term Knowledge Items  : ${knCount} items
• Procedural Solutions       : ${solCount} items
• Episodic Events            : ${epCount} messages
• Conversation Sessions      : ${convCount} sessions
• Backup Snapshots           : ${backups.length} snapshots
• Dense Vector Space         : ${actualDim}-dim (${embRow && embRow.len ? embRow.len : 0} bytes/record)
• Embedding Subsystem        : [${embHealth.status}] (${embHealth.mode}) - ${embHealth.message}
• Database Engine            : brain.db (SQLite WAL Mode, ${dbSize})
--------------------------------------------------
Operational status: Ready and healthy!
`);
            break;
        }

        case 'profile': {
            const profile = getProfileManager();
            const facts = profile.getAll();
            console.log(`\n👑 USER IDENTITY & CORE PROFILE:\n`);
            for (const f of facts) {
                console.log(`  [${f.category}] ${f.key.padEnd(20)}: ${f.value}`);
            }
            console.log('');
            break;
        }

        case 'search': {
            const query = args.slice(1).join(' ');
            if (!query) {
                console.log('Usage: brain search <query>');
                return;
            }
            console.log(`🔍 Search results for: "${query}"\n`);
            const semantic = getSemanticKnowledge();
            const episodic = getEpisodicMemory();

            const kn = await semantic.searchKnowledge(query, { limit: 3 });
            if (kn.length > 0) {
                console.log('--- Knowledge Items & Notes ---');
                for (const k of kn) {
                    console.log(`• [#${k.id} | ${k.category.toUpperCase()}] ${k.title} (Score: ${k.score})`);
                    console.log(`  ${k.content.slice(0, 150)}...\n`);
                }
            }

            const ep = episodic.searchEpisodes(query, 3);
            if (ep.length > 0) {
                console.log('--- Conversation History ---');
                for (const e of ep) {
                    console.log(`• [${e.timestamp.split('T')[0]}] [${e.conv_title || 'Session'}] ${e.role}: ${e.summary}`);
                }
            }
            break;
        }

        case 'reembed': {
            console.log('🔄 Recomputing 384-dim neural embeddings for knowledge items...');
            const semantic = getSemanticKnowledge();
            const count = await semantic.reembedAll();
            console.log(`✅ Successfully upgraded ${count} knowledge items to Multilingual Transformer standard!`);
            break;
        }

        case 'solutions': {
            const solStore = getSolutionStore();
            const list = solStore.getAll();
            console.log(`\n🛠️ PROCEDURAL MEMORY - LEARNED ERROR SOLUTIONS (${list.length} items):\n`);
            for (const s of list) {
                console.log(`• [#${s.id}] Error: "${s.error_pattern}"`);
                console.log(`  Root Cause: ${s.root_cause || 'N/A'}`);
                console.log(`  Solution  : ${s.solution_code}`);
                if (s.command_fix) console.log(`  Command   : ${s.command_fix}`);
                console.log(`  (Scope: ${s.project_scope} | Confidence: ${s.confidence * 100}% | Fixed: ${s.success_count} times)\n`);
            }
            break;
        }

        case 'solution': {
            const query = args.slice(1).join(' ');
            if (!query) {
                console.log('Usage: brain solution <error_pattern>');
                return;
            }
            const solStore = getSolutionStore();
            const results = solStore.searchSolutions(query);
            console.log(`\n🔍 FOUND ${results.length} MATCHING SOLUTIONS:\n`);
            for (const s of results) {
                console.log(`• Error: "${s.error_pattern}"`);
                console.log(`  ➔ Fix: ${s.solution_code}`);
                if (s.command_fix) console.log(`  ➔ Command: ${s.command_fix}`);
                console.log('');
            }
            break;
        }

        case 'store': {
            const title = args[1];
            const content = args.slice(2).join(' ');
            if (!title || !content) {
                console.log('Usage: brain store <title> <content>');
                return;
            }
            const semantic = getSemanticKnowledge();
            const id = await semantic.addItem({
                title,
                content,
                category: 'note',
                tags: 'cli',
                source: 'cli',
                importance: 1.2
            });
            console.log(`✅ Successfully stored knowledge item with ID #${id}`);
            break;
        }

        case 'backup': {
            console.log('💾 Creating hot SQLite backup of Second Brain...');
            const backupMgr = getBackupManager();
            const res = backupMgr.createBackup();
            if (res.success) {
                console.log(`✅ Backup created successfully!`);
                console.log(`• File name: ${res.fileName}`);
                console.log(`• Size: ${(res.sizeBytes / 1024).toFixed(1)} KB`);
                console.log(`• Path: ${res.filePath}`);
            } else {
                console.error(`❌ Backup failed: ${res.error}`);
            }
            break;
        }

        case 'backups': {
            const backupMgr = getBackupManager();
            const list = backupMgr.listBackups();
            console.log(`\n💾 LOCAL BACKUP SNAPSHOTS (${list.length} files):\n`);
            for (const b of list) {
                console.log(`• ${b.fileName.padEnd(36)} | ${(b.sizeBytes / 1024).toFixed(1).padStart(7)} KB | ${b.createdAt}`);
            }
            console.log('');
            break;
        }

        case 'compact': {
            console.log('🧹 Consolidating memory tiers & optimizing database...');
            const consolidator = getMemoryConsolidator();
            const res = consolidator.consolidate();
            console.log(`✅ Consolidation complete!`);
            console.log(`• Distilled sessions: ${res.summarizedConversations}`);
            console.log(`• Deduplicated items: ${res.deduplicatedItems}`);
            console.log(`• Pruned memories: ${res.prunedItems}`);
            console.log(`• SQLite Indexes: ${res.optimized ? 'Optimized' : 'Skipped'}`);
            break;
        }

        case 'graph': {
            const entity = (args[1] && !args[1].startsWith('--')) ? args[1] : 'Ngài';
            const includeExpired = args.includes('--all');
            const semantic = getSemanticKnowledge();
            const relations = semantic.getRelationsForEntity(entity, 2, includeExpired);

            console.log(`\n🌲 BI-TEMPORAL KNOWLEDGE GRAPH (BẢN ĐỒ TRI THỨC ĐỒ THỊ)`);
            console.log(`===================================================================`);
            console.log(`Root Entity: [${entity}] (2-hop traversal)\n`);

            if (!relations || relations.length === 0) {
                console.log(`No entity relationships found for [${entity}].`);
                break;
            }

            const hop1 = relations.filter(r => r.depth === 1);
            const hop2 = relations.filter(r => r.depth === 2);

            for (const r of hop1) {
                const isExpired = r.valid_until && new Date(r.valid_until) <= new Date();
                const statusStr = isExpired ? `❌ Expired (${r.valid_until})` : `✅ Active (Hiệu lực)`;
                const other = (r.source_entity.toLowerCase() === entity.toLowerCase()) ? r.target_entity : r.source_entity;
                const arrow = (r.source_entity.toLowerCase() === entity.toLowerCase()) ? `-[${r.relation}]->` : `<-[${r.relation}]-`;
                console.log(` ├── ${arrow} [${other}] (${statusStr})`);

                const subRelations = hop2.filter(s => 
                    s.source_entity.toLowerCase() === other.toLowerCase() || 
                    s.target_entity.toLowerCase() === other.toLowerCase()
                );
                for (const sub of subRelations) {
                    const subExpired = sub.valid_until && new Date(sub.valid_until) <= new Date();
                    const subStatus = subExpired ? `❌ Expired` : `✅ Active`;
                    const subOther = (sub.source_entity.toLowerCase() === other.toLowerCase()) ? sub.target_entity : sub.source_entity;
                    const subArrow = (sub.source_entity.toLowerCase() === other.toLowerCase()) ? `-[${sub.relation}]->` : `<-[${sub.relation}]-`;
                    console.log(` │    └── ${subArrow} [${subOther}] (${subStatus})`);
                }
            }
            console.log(`\n===================================================================\n`);
            break;
        }

        case 'summarize': {
            const targetId = (args[1] && !args[1].startsWith('--')) ? args[1] : null;
            const force = args.includes('--force');
            const consolidator = getMemoryConsolidator();

            if (targetId) {
                console.log(`🔄 Distilling conversation session: ${targetId}...`);
                const res = consolidator.distillSession(targetId);
                if (res) {
                    console.log(`✅ Successfully distilled session! (Chắt lọc thành công!)`);
                    console.log(`• Executive Summary:\n  ${res.summary}\n`);
                    console.log(`• Goal     : ${res.goal}`);
                    console.log(`• Decisions: ${res.decisions.length ? res.decisions.join('; ') : 'N/A'}`);
                    console.log(`• Files    : ${res.files.length ? res.files.join(', ') : 'N/A'}`);
                    console.log(`• Lessons  : ${res.solutions.length ? res.solutions.join('; ') : 'N/A'}`);
                } else {
                    console.log(`❌ Session not found or insufficient messages.`);
                }
            } else {
                console.log(`🔄 Running autonomous Executive Distillation across all sessions...`);
                const count = consolidator.distillAll(force);
                console.log(`✅ Successfully distilled ${count} conversation sessions!`);
            }
            break;
        }

        case 'dashboard': {
            const { generateDashboard } = require('./src/export_dashboard');
            console.log('🔄 Rendering real-time data for Visual Dashboard...');
            const dashPath = generateDashboard();
            console.log(`🚀 Launching interactive dashboard: ${dashPath}`);
            const { spawn } = require('node:child_process');
            if (process.platform === 'win32') {
                spawn('cmd.exe', ['/c', 'start', '""', dashPath], { detached: true, stdio: 'ignore' }).unref();
            } else if (process.platform === 'darwin') {
                spawn('open', [dashPath], { detached: true, stdio: 'ignore' }).unref();
            } else {
                spawn('xdg-open', [dashPath], { detached: true, stdio: 'ignore' }).unref();
            }
            break;
        }

        case 'data-backup':
        case 'git-backup': {
            console.log('📦 Exporting and synchronizing Second Brain to Private Data Store...');
            const gitBackup = getGitBackupManager();
            const msg = args.slice(1).join(' ') || null;
            const res = gitBackup.commitBackup(msg);
            if (!res.success) {
                console.error(`❌ Git backup failed: ${res.error}`);
                break;
            }
            if (res.committed) {
                console.log(`✅ Commit created: ${res.commit}`);
            } else {
                console.log(`ℹ️ ${res.message}`);
            }
            console.log(`• Profile Facts : ${res.stats.profileCount} items`);
            console.log(`• Knowledge     : ${res.stats.knowledgeCount} items`);
            console.log(`• Solutions     : ${res.stats.solutionsCount} items`);
            console.log(`• Conversations : ${res.stats.conversationsCount} sessions`);
            console.log(`• Exported files: ${res.stats.exportedFiles.join(', ')}`);

            const status = gitBackup.getStatus();
            if (status.remoteUrl) {
                console.log(`🚀 Pushing snapshots to Remote: ${status.remoteUrl}...`);
                const pushRes = gitBackup.pushRemote();
                if (pushRes.success) {
                    console.log(`✅ Successfully pushed to Remote!`);
                } else {
                    console.log(`⚠️ Push to Remote failed: ${pushRes.error}`);
                }
            }
            break;
        }

        case 'data-status':
        case 'git-status': {
            const gitBackup = getGitBackupManager();
            const st = gitBackup.getStatus();
            console.log(`\n🔒 PRIVATE DATA STORE STATUS (antigravity-second-brain-data):\n`);
            if (!st.gitAvailable) {
                console.log(`❌ Git is not available: ${st.error}`);
                break;
            }
            console.log(`• Git Version      : ${st.version}`);
            console.log(`• Repository Status: ${st.initialized ? 'Initialized' : 'Not initialized'}`);
            if (st.initialized) {
                console.log(`• Current Branch   : ${st.branch}`);
                console.log(`• Latest Commit    : ${st.lastCommit}`);
                console.log(`• Remote URL       : ${st.remoteUrl || 'Not configured (run: brain data-remote <url>)'}`);
                console.log(`• Uncommitted Files: ${st.uncommittedCount} file(s)`);
            } else {
                console.log(`• Hint             : Run 'brain data-backup' to initialize repository.`);
            }
            console.log('');
            break;
        }

        case 'engine-status': {
            const gitBackup = getGitBackupManager();
            const st = gitBackup.getEngineStatus();
            console.log(`\n⚙️ OPEN-SOURCE ENGINE STATUS (antigravity-second-brain):\n`);
            if (!st.gitAvailable) {
                console.log(`❌ Git is not available: ${st.error}`);
                break;
            }
            console.log(`• Git Version      : ${st.version}`);
            console.log(`• Repository Status: ${st.initialized ? 'Initialized' : 'Not initialized'}`);
            if (st.initialized) {
                console.log(`• Current Branch   : ${st.branch}`);
                console.log(`• Latest Commit    : ${st.lastCommit}`);
                console.log(`• Remote URL       : ${st.remoteUrl || 'Not configured'}`);
                console.log(`• Modified Files   : ${st.uncommittedCount} file(s)`);
                if (st.modifiedFiles && st.modifiedFiles.length > 0) {
                    console.log(`  ${st.modifiedFiles.join('\n  ')}`);
                }
            }
            console.log('');
            break;
        }

        case 'data-remote':
        case 'git-remote': {
            const url = args[1];
            if (!url) {
                console.log('Usage: brain data-remote <url>');
                return;
            }
            const gitBackup = getGitBackupManager();
            const res = gitBackup.setRemote(url);
            if (res.success) {
                console.log(`✅ Remote URL configured successfully: ${res.remoteUrl}`);
            } else {
                console.error(`❌ Remote configuration failed: ${res.error}`);
            }
            break;
        }

        case 'data-push':
        case 'git-push': {
            console.log('🚀 Pushing snapshots to Remote Data Store...');
            const gitBackup = getGitBackupManager();
            const res = gitBackup.pushRemote();
            if (res.success) {
                console.log(`✅ ${res.message}`);
            } else {
                console.error(`❌ Remote push failed: ${res.error}`);
            }
            break;
        }

        case 'data-pull':
        case 'git-pull': {
            console.log('📥 Pulling latest snapshots and restoring database...');
            const gitBackup = getGitBackupManager();
            const res = gitBackup.pullRemote();
            if (res.success) {
                console.log(`✅ ${res.message}`);
                if (res.import && res.import.success) {
                    console.log(`✔ Database restored: ${res.import.counts.knowledge} knowledge, ${res.import.counts.episodes} episodes, ${res.import.counts.solutions} solutions`);
                }
            } else {
                console.error(`❌ Pull failed: ${res.error}`);
            }
            break;
        }

        case 'data-sync':
        case 'git-sync': {
            console.log('🔄 Performing two-way synchronization (Commit ➔ Pull ➔ Push)...');
            const gitBackup = getGitBackupManager();
            const msg = args.slice(1).join(' ') || null;
            const res = gitBackup.syncRemote(msg);
            if (res.success) {
                console.log(`✅ Full two-way synchronization completed successfully!`);
            } else {
                if (res.commit && res.commit.error) console.error(`⚠️ Commit error: ${res.commit.error}`);
                if (res.pull && !res.pull.success) console.error(`⚠️ Pull error: ${res.pull.error}`);
                if (res.push && !res.push.success) console.error(`⚠️ Push error: ${res.push.error}`);
            }
            break;
        }

        case 'import-dump': {
            const dumpPath = args[1] || null;
            console.log('📥 Restoring database atomically from SQL dump...');
            const gitBackup = getGitBackupManager();
            const res = gitBackup.importDump(dumpPath);
            if (res.success) {
                console.log(`✅ ${res.message}`);
            } else {
                console.error(`❌ Dump restore failed: ${res.error}`);
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
    console.error('Execution error:', err.message);
    process.exit(1);
});
