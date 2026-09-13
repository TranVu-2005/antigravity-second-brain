const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '../../../');
const scriptDir = __dirname;
const agentDir = path.resolve(__dirname, '../');
const sandboxDbPath = path.join(agentDir, 'sandbox_git_brain.db');
const sandboxGitDir = path.join(agentDir, 'sandbox_git_repo');

// 1. Prepare sandbox git repo & database
if (fs.existsSync(sandboxGitDir)) {
    fs.rmSync(sandboxGitDir, { recursive: true, force: true });
}
fs.mkdirSync(sandboxGitDir, { recursive: true });

const pristinePath = path.join(agentDir, 'pristine_brain.db');
const { DatabaseSync } = require('node:sqlite');
const pristineDb = new DatabaseSync(pristinePath, { readOnly: true });
pristineDb.exec("VACUUM INTO '" + sandboxDbPath.replace(/\\/g, '/') + "'");
pristineDb.close();

// Init git in sandbox
execSync('git init -b main', { cwd: sandboxGitDir, stdio: 'ignore' });
execSync('git config user.name "Reviewer"', { cwd: sandboxGitDir, stdio: 'ignore' });
execSync('git config user.email "reviewer@example.com"', { cwd: sandboxGitDir, stdio: 'ignore' });

// 2. Create runner
const wrapperPath = path.join(scriptDir, 'mcp_git_runner.js');
const wrapperCode = `
const path = require('path');
const dbModule = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'src/db'));
const { BrainDB } = dbModule;
const targetDb = new BrainDB('${sandboxDbPath.replace(/\\/g, '/')}');

dbModule.getDB = function() {
    return targetDb;
};

// Override GitBackupManager to point to sandbox
const gitModule = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'src/git_backup'));
const OrigGitMgr = gitModule.GitBackupManager;
class SandboxGitBackupManager extends OrigGitMgr {
    constructor() {
        super('${sandboxGitDir.replace(/\\/g, '/')}', '${path.join(sandboxGitDir, 'exports').replace(/\\/g, '/')}');
    }
}
gitModule.GitBackupManager = SandboxGitBackupManager;
gitModule.getGitBackupManager = function() {
    return new SandboxGitBackupManager();
};

const { SecondBrainMCPServer } = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'mcp_server'));
const server = new SecondBrainMCPServer();
server.start();
`;
fs.writeFileSync(wrapperPath, wrapperCode, 'utf8');

const child = spawn(process.execPath, [wrapperPath], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
const responses = new Map();

child.stdout.on('data', (d) => {
    buffer += d.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const json = JSON.parse(line);
            if (json.id !== undefined) {
                responses.set(json.id, json);
            }
        } catch (e) {}
    }
});

function send(id, method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    child.stdin.write(msg);
}

send(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'git-tester', version: '1.0' }
});

send(2, 'tools/call', {
    name: 'brain_git_backup',
    arguments: { message: 'Initial sandbox backup' }
});

send(3, 'tools/call', {
    name: 'brain_git_status',
    arguments: {}
});

setTimeout(() => {
    child.kill();
    console.log('=== MCP GIT BACKUP TEST RESULTS ===');
    const bkpResp = responses.get(2);
    const stResp = responses.get(3);

    console.log('brain_git_backup response:');
    console.log(JSON.stringify(bkpResp, null, 2));

    console.log('brain_git_status response:');
    console.log(JSON.stringify(stResp, null, 2));

    const backupPassed = bkpResp && bkpResp.result && bkpResp.result.content && !bkpResp.error;
    const statusPassed = stResp && stResp.result && stResp.result.content && !stResp.error;

    // Cleanup
    try {
        fs.unlinkSync(wrapperPath);
        fs.unlinkSync(sandboxDbPath);
        for (const ext of ['-shm', '-wal']) {
            if (fs.existsSync(sandboxDbPath + ext)) fs.unlinkSync(sandboxDbPath + ext);
        }
        fs.rmSync(sandboxGitDir, { recursive: true, force: true });
    } catch (e) {}

    console.log('MCP Git tools passed:', backupPassed && statusPassed);
}, 6000);
