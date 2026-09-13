const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../../');
const serverPath = path.join(projectRoot, 'mcp_server.js');

console.log('Spawning MCP Server:', serverPath);
const child = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'ignore']
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

// Sequence of requests
send(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'reviewer_2-test', version: '1.0' }
});

send(2, 'tools/list', {});

// Read-only tools on live server
send(3, 'tools/call', { name: 'brain_stats', arguments: {} });
send(4, 'tools/call', { name: 'brain_profile_get', arguments: {} });
send(5, 'tools/call', { name: 'brain_search', arguments: { query: 'bảo mật', scope: 'all', limit: 3 } });
send(6, 'tools/call', { name: 'brain_search', arguments: { query: 'antigravity', scope: 'knowledge', limit: 2 } });
send(7, 'tools/call', { name: 'brain_search', arguments: { query: 'thời tiết', scope: 'conversations', limit: 2 } });
send(8, 'tools/call', { name: 'brain_conversation_history', arguments: { query: 'thời tiết', limit: 3 } });
send(9, 'tools/call', { name: 'brain_conversation_history', arguments: { limit: 3 } });
send(10, 'tools/call', { name: 'brain_solution_search', arguments: { query: 'powershell', limit: 2 } });
send(11, 'tools/call', { name: 'brain_git_status', arguments: {} });

setTimeout(() => {
    child.kill();
    console.log('=== MCP SERVER LIVE TOOL TEST RESULTS ===');
    console.log('Total responses received:', responses.size);

    for (let id = 1; id <= 11; id++) {
        const resp = responses.get(id);
        if (!resp) {
            console.error(`ID ${id}: NO RESPONSE RECEIVED`);
            continue;
        }
        if (resp.error) {
            console.error(`ID ${id}: ERROR ->`, JSON.stringify(resp.error));
        } else {
            let summary = '';
            if (id === 1) summary = `Initialized (${resp.result.serverInfo.name} v${resp.result.serverInfo.version})`;
            else if (id === 2) summary = `Tools listed: ${resp.result.tools.length} tools`;
            else if (resp.result && resp.result.content && resp.result.content[0]) {
                const txt = resp.result.content[0].text;
                summary = txt.slice(0, 80).replace(/\r?\n/g, ' ') + '...';
            }
            console.log(`ID ${id}: SUCCESS -> ${summary}`);
        }
    }
}, 4000);
