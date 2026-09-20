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
                resolve(val);
            }
        };
        const timer = setTimeout(() => done(data), 800);
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

        if (!transcriptPath && conversationId) {
            const candidate = path.join('C:/Users/tvu16/.gemini/antigravity/brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
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
            return;
        }

        process.stdout.write(Buffer.from(JSON.stringify({}), 'utf8'));
    } catch (err) {
        // Safe fallback - never crash or hang the agent
        process.stdout.write(Buffer.from(JSON.stringify({}), 'utf8'));
    }
}

main();
