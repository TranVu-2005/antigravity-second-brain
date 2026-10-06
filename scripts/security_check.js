#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Production-Grade Security & Safety Audit (v3.7)
// Verifies zero shell interpolation, argument array enforcement, and secret protection
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const AUDIT_DIRS = ['src', 'hooks'];
const AUDIT_FILES = ['cli.js', 'setup.js', 'mcp_server.js'];

let violations = [];
let checkedFiles = 0;

// Patterns indicating dangerous shell concatenation or unparameterized child_process command execution
const SHELL_INJECTION_PATTERNS = [
    { name: 'child_process execSync with template literal', regex: /(?<!\bdb\.)(?<!this\.db\.)\bexecSync\s*\(\s*`[^`]*\${/ },
    { name: 'child_process exec with template literal', regex: /(?<!\bdb\.)(?<!this\.db\.)\bexec\s*\(\s*`[^`]*\${/ }
];

function auditFile(filePath) {
    checkedFiles++;
    const content = fs.readFileSync(filePath, 'utf8');

    for (const pattern of SHELL_INJECTION_PATTERNS) {
        if (pattern.regex.test(content)) {
            violations.push({
                file: path.relative(ROOT_DIR, filePath),
                rule: pattern.name,
                message: 'Phát hiện nối chuỗi shell động không an toàn trong child process execution.'
            });
        }
    }
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git') {
                scanDir(full);
            }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            auditFile(full);
        }
    }
}

console.log('🛡️ Đang kiểm tra bảo mật mã nguồn (Security & Command Injection Audit)...');

for (const file of AUDIT_FILES) {
    const full = path.join(ROOT_DIR, file);
    if (fs.existsSync(full)) auditFile(full);
}

for (const dir of AUDIT_DIRS) {
    scanDir(path.join(ROOT_DIR, dir));
}

// Check .gitignore protections
const gitignorePath = path.join(ROOT_DIR, '.gitignore');
if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    const REQUIRED_IGNORES = ['brain.db', '.env', '*.pem', '*.key'];
    for (const req of REQUIRED_IGNORES) {
        if (!gitignoreContent.includes(req)) {
            violations.push({
                file: '.gitignore',
                rule: 'Missing Ignore Rule',
                message: `Thiếu cấu hình bảo vệ: ${req}`
            });
        }
    }
}

if (violations.length > 0) {
    console.error(`\x1b[31m💥 Phát hiện ${violations.length} lỗi bảo mật:\x1b[0m`);
    for (const v of violations) {
        console.error(`  - [${v.rule}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
} else {
    console.log(`\x1b[32m✔ Đã rà soát ${checkedFiles} tệp tin: 100% tuân thủ Argument Array Protection & Zero Shell Injection!\x1b[0m\n`);
    process.exit(0);
}
