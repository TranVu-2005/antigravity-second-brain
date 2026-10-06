#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Stop / Post-Invocation Lifecycle Hook
// Background reflection, incremental indexing, and auto-backup
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getEpisodicMemory } = require('../src/episodic');
const { getMemoryExtractor } = require('../src/extractor');
const { getBackupManager } = require('../src/backup');

function readStdin() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
            return resolve('');
        }
        let data = '';
        let settled = false;
        const done = (val) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                try {
                    process.stdin.removeAllListeners();
                    process.stdin.pause();
                } catch (e) {}
                resolve(val);
            }
        };
        const timer = setTimeout(() => done(data), 2000);
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => { data += chunk; });
        process.stdin.on('end', () => done(data));
        process.stdin.on('close', () => done(data));
        process.stdin.on('error', () => done(data));
    });
}

function logEvent(component, message, severity = 'INFO') {
    try {
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, 'second_brain.log');
        const entry = `[${new Date().toISOString()}] [${severity}] [${component}] ${message}\n`;
        fs.appendFileSync(logPath, entry, 'utf8');
    } catch (e) {}
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

        const conversationId = payload.conversationId || null;
        let transcriptPath = payload.transcriptPath || null;

        // CRITICAL FIX: If transcriptPath is missing OR does not exist on disk,
        // resolve to Antigravity's true session transcript location across Windows & Linux
        if ((!transcriptPath || !fs.existsSync(transcriptPath)) && conversationId) {
            const os = require('node:os');
            const brainBase = process.env.ANTIGRAVITY_BRAIN_DIR || path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
            const candidate = path.join(brainBase, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
            if (fs.existsSync(candidate)) {
                transcriptPath = candidate;
            }
        }

        if (transcriptPath && fs.existsSync(transcriptPath)) {
            // 1. Ingest new steps into episodic memory for current session
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

            // 2.6. Autonomous Session Distillation & Tier 1 Working Memory Consolidation
            if (conversationId) {
                try {
                    const { getMemoryConsolidator } = require('../src/consolidation');
                    const consolidator = getMemoryConsolidator();
                    consolidator.distillSession(conversationId);
                } catch (e) {}
            }
        }

        // 3. Automated Daily Snapshot Backup (Non-blocking check)
        try {
            const backupMgr = getBackupManager();
            if (backupMgr.shouldAutoBackup(24)) {
                backupMgr.createBackup();
                logEvent('SnapshotBackup', 'Đã tạo snapshot định kỳ 24h.');
            }
        } catch (e) {
            logEvent('SnapshotBackup', `Lỗi tạo snapshot: ${e.message}`, 'WARN');
        }

        // 4. Git Incremental Local Commit & Detached Push with Smart Throttling
        try {
            const lastCommitFile = path.join(__dirname, '..', '.last_auto_commit');
            const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes throttle
            let shouldCommit = false;
            const now = Date.now();

            if (!fs.existsSync(lastCommitFile)) {
                shouldCommit = true;
            } else {
                try {
                    const lastTime = parseInt(fs.readFileSync(lastCommitFile, 'utf8').trim(), 10);
                    if (isNaN(lastTime) || now - lastTime >= THROTTLE_MS) {
                        shouldCommit = true;
                    }
                } catch (e) {
                    shouldCommit = true;
                }
            }

            if (shouldCommit) {
                const { getGitBackupManager } = require('../src/git_backup');
                const gitMgr = getGitBackupManager();
                const res = gitMgr.commitBackup();
                if (res.committed) {
                    fs.writeFileSync(lastCommitFile, String(now), 'utf8');
                    logEvent('GitBackup', `Thành công commit sao lưu: ${res.commit}`);
                    const st = gitMgr.getStatus();
                    if (st.remoteUrl) {
                        // Fire-and-forget detached full sync (pull rebase + push) to avoid blocking agent loop
                        const { spawn } = require('node:child_process');
                        const cliPath = path.join(__dirname, '..', 'cli.js');
                        const p = spawn('node', [cliPath, 'git-sync'], {
                            cwd: path.resolve(__dirname, '..'),
                            detached: true,
                            stdio: 'ignore',
                            windowsHide: true
                        });
                        p.unref();
                    }
                }
            }
        } catch (e) {
            logEvent('GitBackup', `Lỗi auto commit: ${e.message}`, 'WARN');
        }

        process.stdout.write(Buffer.from(JSON.stringify({}), 'utf8'));
        process.exit(0);
    } catch (err) {
        logEvent('StopHook', `Lỗi nghiêm trọng: ${err.message}`, 'ERROR');
        process.stdout.write(Buffer.from(JSON.stringify({}), 'utf8'));
        process.exit(0);
    }
}

main();
