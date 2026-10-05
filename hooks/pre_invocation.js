#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: PreInvocation Lifecycle Hook
// Injects profile & relevant memories ephemerally before the model responds
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getContextRetriever } = require('../src/retriever');
const { getEpisodicMemory } = require('../src/episodic');

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

        let lastUserPrompt = payload.userPrompt || payload.prompt || payload.input || payload.query || '';

        if (!lastUserPrompt && transcriptPath && fs.existsSync(transcriptPath)) {
            try {
                const content = fs.readFileSync(transcriptPath, 'utf8');
                const lines = content.trim().split('\n');
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (!lines[i].trim()) continue;
                    try {
                        const step = JSON.parse(lines[i]);
                        if (step.type === 'USER_INPUT' && step.content) {
                            lastUserPrompt = getEpisodicMemory().cleanUserContent(step.content);
                            break;
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }

        // Catch-up Sync: Ingest recent missed sessions (< 15ms)
        try {
            getEpisodicMemory().catchUpRecentSessions(2);
        } catch (e) {}

        // Throttled non-blocking background git pull (every 5 mins) to sync memories across Windows & Linux
        try {
            const pullStampFile = path.join(__dirname, '..', '.last_pull');
            const now = Date.now();
            let shouldPull = true;
            if (fs.existsSync(pullStampFile)) {
                const last = parseInt(fs.readFileSync(pullStampFile, 'utf8'), 10);
                if (now - last < 5 * 60 * 1000) {
                    shouldPull = false;
                }
            }
            if (shouldPull) {
                fs.writeFileSync(pullStampFile, now.toString(), 'utf8');
                const { spawn } = require('node:child_process');
                const cliPath = path.join(__dirname, '..', 'cli.js');
                const p = spawn('node', [cliPath, 'git-pull'], {
                    cwd: path.resolve(__dirname, '..'),
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true
                });
                p.unref();
            }
        } catch (e) {}

        const retriever = getContextRetriever();
        const compiledContext = await retriever.compileContext(lastUserPrompt, conversationId, {
            workspacePaths: payload.workspacePaths || []
        });

        if (compiledContext) {
            const output = {
                injectSteps: [
                    {
                        ephemeralMessage: `[ANTIGRAVITY SECOND BRAIN MEMORY LAYER]\n${compiledContext}`
                    }
                ]
            };
            process.stdout.write(Buffer.from(JSON.stringify(output), 'utf8'));
            process.exit(0);
        }

        process.stdout.write(Buffer.from(JSON.stringify({}), 'utf8'));
        process.exit(0);
    } catch (err) {
        // Safe fallback - never crash or hang the agent
        process.stdout.write(Buffer.from(JSON.stringify({}), 'utf8'));
        process.exit(0);
    }
}

main();
