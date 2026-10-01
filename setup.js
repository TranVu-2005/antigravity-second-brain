#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Universal Multi-Platform Installer & Setup Engine
// Zero external dependencies (Ponytail Rung 3) - Runs natively on Linux & Windows
// Safely merges MCP & Hook configurations without clobbering existing settings
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BRAIN_DIR = __dirname;
const GEMINI_DIR = process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini');
const CONFIG_DIR = path.join(GEMINI_DIR, 'config');
const MCP_TARGET_DIR = path.join(GEMINI_DIR, 'antigravity', 'mcp', 'second-brain');
const SKILL_TARGET_DIR = path.join(CONFIG_DIR, 'skills', 'second-brain');

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

async function main() {
    console.log('\n===================================================================');
    console.log('🧠 ANTIGRAVITY SECOND BRAIN — UNIVERSAL INSTALLER & CONFIGURE');
    console.log(`• Hệ điều hành (OS) : ${process.platform} (${os.type()} ${os.release()})`);
    console.log(`• Node Runtime     : ${process.version}`);
    console.log(`• Thư mục Cài đặt  : ${BRAIN_DIR}`);
    console.log(`• Thư mục Gemini   : ${GEMINI_DIR}`);
    console.log('===================================================================\n');

    // 1. Merge MCP Configuration
    logStep('1/5', 'Cấu hình Model Context Protocol (MCP Server)...');
    const mcpConfigPath = path.join(CONFIG_DIR, 'mcp_config.json');
    const mcpConfig = readJsonSafe(mcpConfigPath, { mcpServers: {} });
    if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

    const serverScript = path.join(BRAIN_DIR, 'mcp_server.js');
    mcpConfig.mcpServers['second-brain'] = {
        command: 'node',
        args: [serverScript]
    };
    writeJsonPretty(mcpConfigPath, mcpConfig);
    logSuccess(`Đã tích hợp 'second-brain' vào ${mcpConfigPath} (Bảo toàn các server khác)`);

    // 2. Merge Lifecycle Hooks Configuration
    logStep('2/5', 'Cấu hình Lifecycle Hooks (PreInvocation, PostInvocation, Stop)...');
    const hooksConfigPath = path.join(CONFIG_DIR, 'hooks.json');
    const hooksConfig = readJsonSafe(hooksConfigPath, {});

    const preHook = path.join(BRAIN_DIR, 'hooks', 'pre_invocation.js');
    const postHook = path.join(BRAIN_DIR, 'hooks', 'post_invocation.js');
    const stopHook = path.join(BRAIN_DIR, 'hooks', 'stop.js');

    // Ensure forward slashes for universal cross-platform shell compatibility
    const normalizePath = (p) => p.replace(/\\/g, '/');

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
    logStep('3/5', 'Cài đặt bộ schemas công cụ MCP (14 Tools)...');
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

    // 4. Deploy Antigravity Skill Definition
    logStep('4/5', 'Cài đặt Skill Second Brain (/second-brain)...');
    ensureDir(SKILL_TARGET_DIR);
    const sourceSkill = path.join(BRAIN_DIR, 'integrations', 'skills', 'second-brain', 'SKILL.md');
    if (fs.existsSync(sourceSkill)) {
        fs.copyFileSync(sourceSkill, path.join(SKILL_TARGET_DIR, 'SKILL.md'));
        logSuccess(`Đã cài đặt SKILL.md vào ${SKILL_TARGET_DIR}`);
    } else {
        logWarn(`Không tìm thấy ${sourceSkill}`);
    }

    // 5. Database Verification & Initialization
    logStep('5/5', 'Kiểm tra cơ sở dữ liệu nhận thức (brain.db)...');
    const { BrainDB } = require('./src/db');
    const db = new BrainDB();
    const stats = db.get('SELECT COUNT(*) as kn FROM knowledge_items');
    logSuccess(`Cơ sở dữ liệu SQLite WAL hoạt động ổn định! Hiện có: ${stats.kn} mục tri thức.`);

    console.log('\n===================================================================');
    console.log('🎉 CÀI ĐẶT & CẤU HÌNH ANTIGRAVITY SECOND BRAIN HOÀN TẤT THÀNH CÔNG!');
    console.log('===================================================================');
    console.log('Cách kiểm tra:');
    console.log('  1. Chạy lệnh CLI kiểm tra: node cli.js stats');
    console.log('  2. Khởi động lại Antigravity để nạp MCP server và Hooks mới.');
    console.log('  3. Trải nghiệm: Second Brain sẽ tự động nạp hồ sơ của Ngài trước mỗi câu hỏi!\n');
}

main().catch(err => {
    console.error('\n❌ Lỗi trong quá trình cài đặt:', err);
    process.exit(1);
});
