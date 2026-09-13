const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '../../../');
const scriptDir = __dirname;
const agentDir = path.resolve(__dirname, '../');
const sandboxDbPath = path.join(agentDir, 'sandbox_brain.db');

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

const child = spawn(process.execPath, [wrapperPath], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe']
});

child.stderr.on('data', (d) => {
    console.error('CHILD STDERR:', d.toString());
});

child.stdout.on('data', (d) => {
    console.log('CHILD STDOUT:', d.toString());
});

child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');

setTimeout(() => {
    child.kill();
    fs.unlinkSync(wrapperPath);
}, 2000);
