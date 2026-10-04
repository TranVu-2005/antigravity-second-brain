const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'mcp_server.js');
const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'ignore'] });

let output = '';
child.stdout.on('data', (d) => {
    output += d.toString();
});

function send(msg) {
    child.stdin.write(JSON.stringify(msg) + '\n');
}

// 1. Send initialize
send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0' }
    }
});

// 2. Send tools/list
send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
});

// 3. Send tools/call (brain_stats)
send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
        name: 'brain_stats',
        arguments: {}
    }
});

setTimeout(() => {
    child.kill();
    console.log('--- MCP SERVER RESPONSES ---');
    const lines = output.trim().split('\n');
    for (const l of lines) {
        if (!l.trim()) continue;
        try {
            const parsed = JSON.parse(l);
            console.log(`ID ${parsed.id}:`, parsed.result ? 'OK' : 'ERROR', parsed.result ? Object.keys(parsed.result) : parsed.error);
            if (parsed.id === 3) {
                console.log('brain_stats content:\n', parsed.result.content[0].text);
            }
        } catch (e) {
            console.log('Non-JSON line:', l);
        }
    }
}, 2500);
