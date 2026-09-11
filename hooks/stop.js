#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Stop / Post-Invocation Lifecycle Hook
// Background reflection, incremental indexing, and auto-backup
// ==============================================================================

const fs = require('node:fs');
const { getEpisodicMemory } = require('../src/episodic');
const { getMemoryExtractor } = require('../src/extractor');
const { getBackupManager } = require('../src/backup');

function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => { data += chunk; });
        process.stdin.on('end', () => { resolve(data); });
        // Failsafe timeout
        setTimeout(() => resolve(data), 3000);
    });
}

async function main() {
    try {
        const raw = await readStdin();
        let payload = {};
        try {
            payload = JSON.parse(raw);
        } catch (e) {
            payload = {};
        }

        const transcriptPath = payload.transcriptPath || null;
        const conversationId = payload.conversationId || null;

        if (transcriptPath && fs.existsSync(transcriptPath)) {
            // 1. Ingest new steps into episodic memory
            const episodic = getEpisodicMemory();
            episodic.ingestTranscriptFile(transcriptPath, conversationId);

            // 2. Extract facts from latest user inputs
            try {
                const extractor = getMemoryExtractor();
                const content = fs.readFileSync(transcriptPath, 'utf8');
                const lines = content.trim().split('\n');
                const recent = lines.slice(-5);
                for (const line of recent) {
                    if (!line.trim()) continue;
                    try {
                        const step = JSON.parse(line);
                        if (step.type === 'USER_INPUT' && step.content) {
                            extractor.extractFromText(step.content, 'user');
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            // 2.5. Autonomous Tool Execution Reinforcement (Tự động học từ lỗi lệnh và lưu lệnh đúng)
            try {
                const { getReinforcementLearner } = require('../src/reinforcement');
                const learner = getReinforcementLearner();
                learner.mineTranscript(transcriptPath);
            } catch (e) {}
        }

        // 3. Automated Daily Snapshot Backup (Non-blocking check)
        try {
            const backupMgr = getBackupManager();
            if (backupMgr.shouldAutoBackup(24)) {
                backupMgr.createBackup();
            }
        } catch (e) {}

        // 4. Git Incremental Synchronization (Event-Driven: Ngay khi có tri thức mới)
        try {
            const { getGitBackupManager } = require('../src/git_backup');
            const gitMgr = getGitBackupManager();
            const res = gitMgr.commitBackup();
            if (res.committed) {
                const st = gitMgr.getStatus();
                if (st.remoteUrl) {
                    gitMgr.pushRemote();
                }
            }
        } catch (e) {}

        process.stdout.write(JSON.stringify({}));
    } catch (err) {
        process.stdout.write(JSON.stringify({}));
    }
}

main();
