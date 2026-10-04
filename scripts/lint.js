#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Zero-Dependency Syntax Validator (node --check)
// Validates JavaScript AST & syntax integrity across all project source files
// ==============================================================================

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const TARGET_DIRS = ['src', 'hooks', 'test', 'scripts'];
const STANDALONE_FILES = ['cli.js', 'setup.js', 'mcp_server.js'];

let checkedCount = 0;
let errors = [];

function checkFile(filePath) {
    checkedCount++;
    const result = spawnSync(process.execPath, ['--check', filePath], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        errors.push({ file: filePath, stderr: result.stderr });
    }
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            checkFile(fullPath);
        }
    }
}

console.log('🔍 Validating JavaScript syntax across codebase...');

for (const file of STANDALONE_FILES) {
    const fullPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(fullPath)) checkFile(fullPath);
}

for (const dir of TARGET_DIRS) {
    scanDir(path.join(ROOT_DIR, dir));
}

if (errors.length > 0) {
    console.error(`\x1b[31m✖ Found ${errors.length} syntax error(s):\x1b[0m`);
    for (const err of errors) {
        console.error(`  - ${path.relative(ROOT_DIR, err.file)}:\n${err.stderr}`);
    }
    process.exit(1);
} else {
    console.log(`\x1b[32m✔ Verified ${checkedCount} JavaScript files without syntax errors.\x1b[0m`);
    process.exit(0);
}
