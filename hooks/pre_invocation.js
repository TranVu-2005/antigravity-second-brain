#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: PreInvocation Lifecycle Hook
// Injects profile & relevant memories ephemerally before the model responds
// ==============================================================================

const fs = require('node:fs');
const { getContextRetriever } = require('../src/retriever');
const { getEpisodicMemory } = require('../src/episodic');

function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => { data += chunk; });
        process.stdin.on('end', () => { resolve(data); });
        // Failsafe timeout
        setTimeout(() => resolve(data), 2500);
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
        const transcriptPath = payload.transcriptPath || null;

        let lastUserPrompt = '';

        if (transcriptPath && fs.existsSync(transcriptPath)) {
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
            process.stdout.write(JSON.stringify(output));
            return;
        }

        process.stdout.write(JSON.stringify({}));
    } catch (err) {
        // Safe fallback - never crash or hang the agent
        process.stdout.write(JSON.stringify({}));
    }
}

main();
