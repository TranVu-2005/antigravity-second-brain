const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const projectRoot = path.resolve(__dirname, '../../../');
const scriptDir = __dirname;
const agentDir = path.resolve(__dirname, '../');
const sandboxDbPath = path.join(agentDir, 'sandbox_brain.db');

// 1. Clone pristine_brain.db to sandbox_brain.db
if (fs.existsSync(sandboxDbPath)) fs.unlinkSync(sandboxDbPath);
for (const ext of ['-shm', '-wal']) {
    if (fs.existsSync(sandboxDbPath + ext)) fs.unlinkSync(sandboxDbPath + ext);
}

const pristinePath = path.join(agentDir, 'pristine_brain.db');
const pristineDb = new DatabaseSync(pristinePath, { readOnly: true });
pristineDb.exec("VACUUM INTO '" + sandboxDbPath.replace(/\\/g, '/') + "'");
pristineDb.close();
console.log('Cloned pristine_brain.db to sandbox_brain.db');

// 2. Create wrapper runner that overrides getDB
const wrapperPath = path.join(scriptDir, 'mcp_sandbox_runner.js');
const wrapperCode = `
const path = require('path');
const dbModule = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'src/db'));
const { BrainDB } = dbModule;
const targetDb = new BrainDB('${sandboxDbPath.replace(/\\/g, '/')}');

dbModule.getDB = function() {
    return targetDb;
};

const { SecondBrainMCPServer } = require(path.resolve('${projectRoot.replace(/\\/g, '/')}', 'mcp_server'));
const server = new SecondBrainMCPServer();
server.start();
`;
fs.writeFileSync(wrapperPath, wrapperCode, 'utf8');

// 3. Spawn child process
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

child.stderr.on('data', (d) => {
    // console.log('STDERR:', d.toString());
});

function send(id, method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    child.stdin.write(msg);
}

// 4. Send requests
send(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'sandbox-tester', version: '1.0' }
});

send(2, 'tools/call', {
    name: 'brain_store',
    arguments: {
        title: 'Sandbox Test Knowledge',
        content: 'Sandbox Test Content for verification',
        category: 'fact',
        tags: 'test,sandbox'
    }
});

send(3, 'tools/call', {
    name: 'brain_search',
    arguments: {
        query: 'Sandbox Test Knowledge',
        scope: 'knowledge'
    }
});

send(4, 'tools/call', {
    name: 'brain_profile_set',
    arguments: {
        key: 'sandbox_test_pref',
        value: 'verified_active',
        category: 'preference'
    }
});

send(5, 'tools/call', {
    name: 'brain_profile_get',
    arguments: {}
});

send(6, 'tools/call', {
    name: 'brain_solution_store',
    arguments: {
        error_pattern: 'SANDBOX_ERR_404',
        solution_code: 'npm cache clean --force',
        root_cause: 'Corrupt cache',
        command_fix: 'npm cache verify'
    }
});

send(7, 'tools/call', {
    name: 'brain_solution_search',
    arguments: {
        query: 'SANDBOX_ERR_404'
    }
});

send(8, 'tools/call', {
    name: 'brain_stats',
    arguments: {}
});

setTimeout(() => {
    child.kill();
    console.log('=== SANDBOX MCP MUTATION TEST RESULTS ===');
    console.log('Total responses received:', responses.size);

    let allPassed = true;
    for (let id = 1; id <= 8; id++) {
        const resp = responses.get(id);
        if (!resp) {
            console.error(`ID ${id}: NO RESPONSE`);
            allPassed = false;
            continue;
        }
        if (resp.error) {
            console.error(`ID ${id}: ERROR ->`, resp.error);
            allPassed = false;
        } else {
            let txt = '';
            if (id === 1) txt = `Initialized OK`;
            else if (resp.result && resp.result.content && resp.result.content[0]) {
                txt = resp.result.content[0].text.replace(/\r?\n/g, ' ').slice(0, 90);
            }
            console.log(`ID ${id}: PASS -> ${txt}`);
        }
    }

    // Cleanup
    try {
        fs.unlinkSync(wrapperPath);
        fs.unlinkSync(sandboxDbPath);
        for (const ext of ['-shm', '-wal']) {
            if (fs.existsSync(sandboxDbPath + ext)) fs.unlinkSync(sandboxDbPath + ext);
        }
    } catch (e) {}

    console.log('Cleanup complete. All mutation tests passed:', allPassed);
}, 6000);
