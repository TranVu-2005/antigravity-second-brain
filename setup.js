#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Universal Multi-Platform Installer & Setup Engine
// Zero external dependencies (Ponytail Rung 3) - Runs natively on Linux & Windows
// Safely merges MCP, Hooks, Skills (/superpowers, /second-brain), Rules & DB
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BRAIN_DIR = __dirname;
const GEMINI_DIR = process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini');
const CONFIG_DIR = path.join(GEMINI_DIR, 'config');
const MCP_TARGET_DIR = path.join(GEMINI_DIR, 'antigravity', 'mcp', 'second-brain');
const SKILLS_TARGET_DIR = path.join(CONFIG_DIR, 'skills');

function logStep(step, message) {
    console.log(`\x1b[36m[${step}]\x1b[0m ${message}`);
}

function logSuccess(message) {
    console.log(`\x1b[32m✔ ${message}\x1b[0m`);
}

function logWarn(message) {
    console.log(`\x1b[33m▲ ${message}\x1b[0m`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function readJsonSafe(filePath, defaultVal = {}) {
    if (!fs.existsSync(filePath)) return defaultVal;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        logWarn(`Không thể parse JSON tại ${filePath}, sử dụng giá trị mặc định: ${e.message}`);
        return defaultVal;
    }
}

function writeJsonPretty(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Universal path normalization for cross-platform execution (Linux / Windows)
const normalizePath = (p) => p.replace(/\\/g, '/');

async function main() {
    console.log('\n===================================================================');
    console.log('🧠 ANTIGRAVITY SECOND BRAIN & SUPERPOWERS — UNIVERSAL INSTALLER');
    console.log(`• Hệ điều hành (OS) : ${process.platform} (${os.type()} ${os.release()})`);
    console.log(`• Node Runtime     : ${process.version}`);
    console.log(`• Thư mục Cài đặt  : ${BRAIN_DIR}`);
    console.log(`• Thư mục Gemini   : ${GEMINI_DIR}`);
    console.log('===================================================================\n');

    // 1. Merge MCP Configuration
    logStep('1/6', 'Cấu hình Model Context Protocol (MCP Server)...');
    const mcpConfigPath = path.join(CONFIG_DIR, 'mcp_config.json');
    const mcpConfig = readJsonSafe(mcpConfigPath, { mcpServers: {} });
    if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

    const serverScript = path.join(BRAIN_DIR, 'mcp_server.js');
    mcpConfig.mcpServers['second-brain'] = {
        command: 'node',
        args: [normalizePath(serverScript)]
    };
    writeJsonPretty(mcpConfigPath, mcpConfig);
    logSuccess(`Đã tích hợp 'second-brain' vào ${mcpConfigPath}`);

    // 2. Merge Lifecycle Hooks Configuration
    logStep('2/6', 'Cấu hình Lifecycle Hooks (PreInvocation, PostInvocation, Stop)...');
    const hooksConfigPath = path.join(CONFIG_DIR, 'hooks.json');
    const hooksConfig = readJsonSafe(hooksConfigPath, {});

    const preHook = path.join(BRAIN_DIR, 'hooks', 'pre_invocation.js');
    const postHook = path.join(BRAIN_DIR, 'hooks', 'post_invocation.js');
    const stopHook = path.join(BRAIN_DIR, 'hooks', 'stop.js');

    hooksConfig['second-brain'] = {
        PreInvocation: [
            {
                type: 'command',
                command: `node "${normalizePath(preHook)}"`,
                timeout: 5
            }
        ],
        PostInvocation: [
            {
                type: 'command',
                command: `node "${normalizePath(postHook)}"`,
                timeout: 10
            }
        ],
        Stop: [
            {
                type: 'command',
                command: `node "${normalizePath(stopHook)}"`,
                timeout: 15
            }
        ]
    };
    writeJsonPretty(hooksConfigPath, hooksConfig);
    logSuccess(`Đã cập nhật lifecycle hooks vào ${hooksConfigPath}`);

    // 3. Deploy MCP Tool Schemas
    logStep('3/6', 'Cài đặt bộ schemas công cụ MCP (14 Tools)...');
    ensureDir(MCP_TARGET_DIR);
    const sourceSchemasDir = path.join(BRAIN_DIR, 'integrations', 'mcp_schemas');
    if (fs.existsSync(sourceSchemasDir)) {
        const schemas = fs.readdirSync(sourceSchemasDir);
        for (const schemaFile of schemas) {
            fs.copyFileSync(
                path.join(sourceSchemasDir, schemaFile),
                path.join(MCP_TARGET_DIR, schemaFile)
            );
        }
        logSuccess(`Đã nạp ${schemas.length} MCP tool schemas vào ${MCP_TARGET_DIR}`);
    } else {
        logWarn(`Không tìm thấy thư mục ${sourceSchemasDir}`);
    }

    // 4. Deploy Full Suite of Skills (/superpowers, /second-brain, /ponytail...)
    logStep('4/6', 'Cài đặt toàn bộ bộ kỹ năng nhận thức & Superpowers (/superpowers)...');
    ensureDir(SKILLS_TARGET_DIR);
    const sourceSkillsDir = path.join(BRAIN_DIR, 'integrations', 'skills');
    let installedSkillCount = 0;
    if (fs.existsSync(sourceSkillsDir)) {
        const skillEntries = fs.readdirSync(sourceSkillsDir, { withFileTypes: true });
        for (const entry of skillEntries) {
            if (entry.isDirectory()) {
                const srcSkillPath = path.join(sourceSkillsDir, entry.name);
                const destSkillPath = path.join(SKILLS_TARGET_DIR, entry.name);
                copyDirRecursive(srcSkillPath, destSkillPath);
                installedSkillCount++;
            }
        }
        logSuccess(`Đã triển khai thành công ${installedSkillCount} skills vào ${SKILLS_TARGET_DIR} (Bao gồm /superpowers, /second-brain, /ponytail, /tdd-master...)`);
    } else {
        logWarn(`Không tìm thấy thư mục ${sourceSkillsDir}`);
    }

    // 5. Deploy Global Rules (GEMINI.md)
    logStep('5/6', 'Đồng bộ Quy tắc Toàn cục & Persona (GEMINI.md)...');
    const sourceRules = path.join(BRAIN_DIR, 'integrations', 'GEMINI.md');
    const destRules = path.join(CONFIG_DIR, 'GEMINI.md');
    if (fs.existsSync(sourceRules)) {
        if (!fs.existsSync(destRules)) {
            ensureDir(CONFIG_DIR);
            fs.copyFileSync(sourceRules, destRules);
            logSuccess(`Đã cài đặt GEMINI.md mới vào ${destRules}`);
        } else {
            const currentRules = fs.readFileSync(destRules, 'utf8');
            if (!currentRules.includes('Cognitive Second Brain Integration')) {
                const combined = currentRules + '\n\n' + fs.readFileSync(sourceRules, 'utf8');
                fs.writeFileSync(destRules, combined, 'utf8');
                logSuccess(`Đã tích hợp quy tắc Second Brain vào ${destRules}`);
            } else {
                logSuccess(`Tệp ${destRules} đã sẵn sàng với quy chuẩn Persona & Second Brain.`);
            }
        }
    }

    // 6. Database Verification & Auto-Recovery
    logStep('6/6', 'Kiểm tra & Khởi tạo cơ sở dữ liệu nhận thức (brain.db)...');
    const { BrainDB } = require('./src/db');
    const { GitBackupManager } = require('./src/git_backup');
    const db = new BrainDB();
    const gitMgr = new GitBackupManager(BRAIN_DIR, path.join(BRAIN_DIR, 'exports'), db);
    let stats = db.get('SELECT COUNT(*) as kn FROM knowledge_items');

    // Auto-restore from dump.sql (Private Data Store) or templates/seed.sql (Clean Template Seed)
    if (stats.kn === 0) {
        const dumpPath = path.join(BRAIN_DIR, 'exports', 'dump.sql');
        const seedPath = path.join(BRAIN_DIR, 'templates', 'seed.sql');

        if (fs.existsSync(dumpPath)) {
            console.log('  ↳ CSDL mới tinh, tự động phục hồi dữ liệu từ exports/dump.sql qua atomic importDump...');
            const restoreRes = gitMgr.importDump(dumpPath);
            if (!restoreRes.success) {
                logWarn(`Cảnh báo phục hồi từ dump.sql: ${restoreRes.error}`);
            } else {
                stats = db.get('SELECT COUNT(*) as kn FROM knowledge_items');
                const epCount = db.get('SELECT COUNT(*) as c FROM episodes').c;
                const entCount = db.get('SELECT COUNT(*) as c FROM entities').c;
                logSuccess(`Đã phục hồi nguyên tử thành công: ${stats.kn} tri thức, ${epCount} episodes, ${entCount} entities!`);
            }
        } else if (fs.existsSync(seedPath)) {
            console.log('  ↳ Khởi tạo CSDL sạch từ templates/seed.sql qua atomic importDump...');
            const seedRes = gitMgr.importDump(seedPath);
            if (!seedRes.success) {
                logWarn(`Lỗi phục hồi seed: ${seedRes.error}`);
            } else {
                stats = db.get('SELECT COUNT(*) as kn FROM knowledge_items');
                logSuccess(`Đã nạp schema và tri thức mẫu ban đầu (${stats.kn} mục)!`);
                console.log('  💡 Mẹo: Chạy `agy-brain data-pull` để nạp kho ký ức cá nhân từ antigravity-second-brain-data.');
            }
        }
    }
    logSuccess(`Cơ sở dữ liệu SQLite WAL hoạt động hoàn hảo! Hiện có: ${stats.kn} mục tri thức.`);

    // Bonus: POSIX / Linux Permissions & Shell Utilities
    if (process.platform !== 'win32') {
        try {
            // Set executable permissions on scripts
            const makeExec = (file) => {
                try { if (fs.existsSync(file)) fs.chmodSync(file, 0o755); } catch (e) {}
            };
            makeExec(path.join(BRAIN_DIR, 'install.sh'));
            makeExec(path.join(BRAIN_DIR, 'setup.js'));
            makeExec(path.join(BRAIN_DIR, 'cli.js'));
            makeExec(path.join(BRAIN_DIR, 'mcp_server.js'));
            makeExec(preHook);
            makeExec(postHook);
            makeExec(stopHook);

            // Setup ~/.local/bin shortcuts for Linux
            const localBin = path.join(os.homedir(), '.local', 'bin');
            ensureDir(localBin);

            const linuxTempSrc = path.join(BRAIN_DIR, 'scripts', 'linux', 'temp');
            const linuxScreenoffSrc = path.join(BRAIN_DIR, 'scripts', 'linux', 'screenoff');
            const linuxTempDest = path.join(localBin, 'temp');
            const linuxScreenoffDest = path.join(localBin, 'screenoff');
            const brainCliDest = path.join(localBin, 'agy-brain');

            if (fs.existsSync(linuxTempSrc)) {
                fs.copyFileSync(linuxTempSrc, linuxTempDest);
                makeExec(linuxTempDest);
            }
            if (fs.existsSync(linuxScreenoffSrc)) {
                fs.copyFileSync(linuxScreenoffSrc, linuxScreenoffDest);
                makeExec(linuxScreenoffDest);
            }
            // Create agy-brain CLI wrapper
            const cliWrapperContent = `#!/bin/sh\nexec node "${normalizePath(path.join(BRAIN_DIR, 'cli.js'))}" "$@"\n`;
            fs.writeFileSync(brainCliDest, cliWrapperContent, 'utf8');
            makeExec(brainCliDest);

            logSuccess(`Đã cấp quyền 755 và cài đặt phím tắt Linux (temp, screenoff, agy-brain) vào ${localBin}`);
        } catch (e) {
            logWarn(`Lưu ý cấu hình Linux permission: ${e.message}`);
        }
    }

    console.log('\n===================================================================');
    console.log('🎉 CÀI ĐẶT ANTIGRAVITY SECOND BRAIN & SUPERPOWERS THÀNH CÔNG RỰC RỠ!');
    console.log('===================================================================');
    console.log('Hệ thống đã sẵn sàng 100% trên cả Windows và Linux:');
    console.log('  1. MCP Server `second-brain` đã nạp và bảo toàn các server hiện có.');
    console.log('  2. Lifecycle Hooks (`PreInvocation`, `PostInvocation`, `Stop`) đã kích hoạt.');
    console.log(`  3. Đã cài đặt ${installedSkillCount} skills nhận thức (Bao gồm /superpowers, /second-brain).`);
    console.log('  4. Ký ức nhận thức và tri thức đã đồng bộ từ SQLite WAL.\n');
}

main().catch(err => {
    console.error('\n❌ Lỗi trong quá trình cài đặt:', err);
    process.exit(1);
});
