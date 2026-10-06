#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Unified Master Test Runner (Ponytail Rung 1)
// Runs all regression & breakthrough suites in isolated child processes
// ==============================================================================

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SUITES = [
    { name: 'v2.0 Core Architecture Suite', file: 'test_brain.js' },
    { name: 'v3.0 SOTA Breakthrough Suite', file: 'test_v3_production_grade.js' },
    { name: 'v3.4 Production Verification Suite', file: 'test_v3_4_production.js' },
    { name: 'v3.5 Ingestion & Sanitization Suite', file: 'test_v3_5_production.js' },
    { name: 'v3.7 Production Hardening Suite', file: 'test_v3_7_hardening.js' },
    { name: 'v3.8 Hardening, Atomic Restore & Trust Suite', file: 'test_v3_8_hardening.js' },
    { name: 'MCP JSON-RPC Stdio Protocol Suite', file: 'test_mcp.js' },
    { name: 'Adversarial Extractor Robustness Suite', file: 'test_extractor_adversarial.js' },
    { name: 'Adversarial Retrieval Quality Suite', file: 'adversarial_retrieval_test.js' },
    { name: 'Embedding Health & Fallback Suite', file: 'test_embed_api.js' },
    { name: 'Lifecycle Pre-Invocation Hook Suite', file: 'test_hook.js' }
];

const testDir = __dirname;
let passedSuites = 0;
let failedSuites = 0;
const startTime = Date.now();

console.log('╔════════════════════════════════════════════════════════════════════════╗');
console.log('║       🧠 ANTIGRAVITY SECOND BRAIN — MASTER CI/CD TEST RUNNER           ║');
console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

for (const suite of SUITES) {
    const fullPath = path.join(testDir, suite.file);
    console.log(`▶ Executing: [${suite.name}] (${suite.file})...`);
    const suiteStart = Date.now();
    const result = spawnSync(process.execPath, [fullPath], {
        cwd: path.join(testDir, '..'),
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test' }
    });
    const duration = ((Date.now() - suiteStart) / 1000).toFixed(2);

    if (result.status === 0) {
        passedSuites++;
        console.log(`  \x1b[32m✔ PASSED\x1b[0m in ${duration}s\n`);
    } else {
        failedSuites++;
        console.error(`  \x1b[31m✖ FAILED\x1b[0m with exit code ${result.status} in ${duration}s:`);
        if (result.stdout) console.log(result.stdout);
        if (result.stderr) console.error(result.stderr);
        console.log('');
    }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('────────────────────────────────────────────────────────────────────────');
console.log(`🏁 SUMMARY: ${passedSuites}/${SUITES.length} test suites passed in ${totalDuration}s.`);

if (failedSuites > 0) {
    console.error(`\x1b[31m💥 ${failedSuites} test suite(s) failed.\x1b[0m`);
    process.exit(1);
} else {
    console.log('\x1b[32m🎉 ALL TEST SUITES PASSED FLAWLESSLY!\x1b[0m\n');
    process.exit(0);
}
