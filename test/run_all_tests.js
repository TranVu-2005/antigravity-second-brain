#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Dynamic Master Test Runner (Ponytail Rung 1)
// Automatically discovers and runs all regression & hardening test suites
// ==============================================================================

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const testDir = __dirname;

// Dynamically discover all test files matching test_*.js or *_test.js
const testFiles = fs.readdirSync(testDir)
    .filter(f => (f.startsWith('test_') || f.endsWith('_test.js')) && f.endsWith('.js') && f !== 'run_all_tests.js')
    .sort();

let passedSuites = 0;
let failedSuites = 0;
const startTime = Date.now();

console.log('╔════════════════════════════════════════════════════════════════════════╗');
console.log('║       🧠 ANTIGRAVITY SECOND BRAIN — MASTER CI/CD TEST RUNNER           ║');
console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

for (const file of testFiles) {
    const fullPath = path.join(testDir, file);
    console.log(`▶ Executing suite: ${file}...`);
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
console.log(`🏁 SUMMARY: ${passedSuites}/${testFiles.length} test suites passed in ${totalDuration}s.`);

if (failedSuites > 0) {
    console.error(`\x1b[31m❌ CI/CD GATE FAILED: ${failedSuites} suite(s) broke invariants.\x1b[0m`);
    process.exit(1);
} else {
    console.log(`\x1b[32m✨ 100% QUALITY ASSURANCE CERTIFIED — All suites passed flawlessly.\x1b[0m`);
    process.exit(0);
}
