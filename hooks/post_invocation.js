#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: PostInvocation Lifecycle Hook
// Fires immediately after the assistant finishes speaking / tool execution completes
// Zero-lag episodic ingestion and autonomous reflection
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getEpisodicMemory } = require('../src/episodic');
const { getMemoryConsolidator } = require('../src/consolidation');

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

        if ((!transcriptPath || !fs.existsSync(transcriptPath)) && conversationId) {
            const candidate = path.join('C:/Users/tvu16/.gemini/antigravity/brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
            if (fs.existsSync(candidate)) {
                transcriptPath = candidate;
            }
        }

        if (transcriptPath && fs.existsSync(transcriptPath)) {
            // 1. Ingest new steps into episodic memory for current session
            try {
                const episodic = getEpisodicMemory();
                episodic.ingestTranscriptFile(transcriptPath, conversationId);
            } catch (e) {}

            // 2. Autonomous Session Distillation & Tier 1 Working Memory Consolidation
            if (conversationId) {
                try {
                    const consolidator = getMemoryConsolidator();
                    consolidator.distillSession(conversationId);
                } catch (e) {}
            }
        }

        // Output standard PostInvocation contract: injectSteps empty array
        const response = {
            injectSteps: []
        };
        process.stdout.write(Buffer.from(JSON.stringify(response), 'utf8'));
        process.exit(0);
    } catch (err) {
        // Safe fallback - never crash or hang the agent
        process.stdout.write(Buffer.from(JSON.stringify({ injectSteps: [] }), 'utf8'));
        process.exit(0);
    }
}

main();
