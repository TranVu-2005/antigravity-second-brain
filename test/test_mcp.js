#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Production MCP Protocol Conformance Test Suite
// Rigorously asserts JSON-RPC 2.0 lifecycle, protocol negotiation, 
// 14/14 tool schema contracts, argument rejection, and tool execution.
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const serverPath = path.join(__dirname, '..', 'mcp_server.js');
const pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

test('MCP Protocol Conformance & Tool Contract Verification', async () => {
    const child = spawn(process.execPath, [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
    });

    const responses = new Map();
    let rawBuffer = '';

    child.stdout.on('data', (chunk) => {
        rawBuffer += chunk.toString();
        const lines = rawBuffer.split('\n');
        rawBuffer = lines.pop(); // keep remainder

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.id !== undefined) {
                    responses.set(parsed.id, parsed);
                }
            } catch (e) {}
        }
    });

    const sendRpc = (msg) => {
        child.stdin.write(JSON.stringify(msg) + '\n');
    };

    const waitForResponse = async (id, timeoutMs = 3000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (responses.has(id)) return responses.get(id);
            await new Promise((r) => setTimeout(r, 20));
        }
        throw new Error(`Timeout waiting for JSON-RPC response ID ${id}`);
    };

    try {
        // 1. Test Initialize & Protocol Negotiation (MCP-002)
        sendRpc({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2026-07-28',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0' }
            }
        });

        const initRes = await waitForResponse(1);
        assert.ok(initRes.result, 'Initialize response must contain result');
        assert.strictEqual(initRes.result.protocolVersion, '2026-07-28', 'Must negotiate supported protocolVersion');
        assert.strictEqual(initRes.result.serverInfo.name, 'antigravity-second-brain');
        assert.strictEqual(initRes.result.serverInfo.version, pkgVersion, `serverInfo version must match package version ${pkgVersion}`);

        // 2. Test Notifications (id is null/undefined) - server must not crash or error
        sendRpc({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {}
        });

        // 3. Test tools/list schema verification (MCP-001)
        sendRpc({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        });

        const listRes = await waitForResponse(2);
        assert.ok(listRes.result && Array.isArray(listRes.result.tools), 'tools/list must return array of tools');
        const tools = listRes.result.tools;
        assert.strictEqual(tools.length, 14, 'Must expose exactly 14 MCP tools');

        const toolNames = new Set();
        for (const tool of tools) {
            assert.ok(tool.name, 'Tool must possess a name');
            toolNames.add(tool.name);
            assert.ok(tool.description && tool.description.length > 5, `Tool ${tool.name} must have a descriptive doc`);
            assert.ok(tool.inputSchema, `Tool ${tool.name} must specify inputSchema`);
            assert.strictEqual(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema must be type object`);
        }

        // Verify required canonical tools
        const canonicalTools = [
            'brain_search', 'brain_store', 'brain_delete', 'brain_profile_get',
            'brain_profile_set', 'brain_conversation_history', 'brain_solution_search',
            'brain_solution_store', 'brain_stats', 'brain_git_backup', 'brain_git_status',
            'brain_remember', 'brain_forget', 'brain_learn_fix'
        ];
        for (const c of canonicalTools) {
            assert.ok(toolNames.has(c), `Must include canonical tool ${c}`);
        }

        // 4. Test brain_stats execution
        sendRpc({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'brain_stats',
                arguments: {}
            }
        });

        const statsRes = await waitForResponse(3);
        assert.ok(statsRes.result && statsRes.result.content, 'brain_stats must return content');
        const statsText = statsRes.result.content[0].text;
        assert.ok(statsText.includes(`v${pkgVersion}`), `brain_stats text must reflect version v${pkgVersion}`);
        assert.ok(statsText.includes('SQLite WAL mode'), 'brain_stats must report engine status');

        // 5. Test brain_remember execution
        sendRpc({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'brain_remember',
                arguments: {
                    key: 'test_mcp_pref',
                    text: 'Ngài ưa chuộng kiến trúc zero npm runtime dependencies',
                    category: 'preference'
                }
            }
        });

        const remRes = await waitForResponse(4);
        assert.ok(remRes.result && remRes.result.content, 'brain_remember must succeed');
        assert.ok(remRes.result.content[0].text.includes('test_mcp_pref'), 'Result must acknowledge key');

        // 6. Test brain_forget cascading execution
        sendRpc({
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
                name: 'brain_forget',
                arguments: {
                    key: 'test_mcp_pref',
                    reason: 'Clean test assertion'
                }
            }
        });

        const forRes = await waitForResponse(5);
        assert.ok(forRes.result && forRes.result.content, 'brain_forget must succeed');
        assert.ok(forRes.result.content[0].text.includes('test_mcp_pref'), 'Result must acknowledge forgotten key');

        // 7. Test unknown tool rejection
        sendRpc({
            jsonrpc: '2.0',
            id: 6,
            method: 'tools/call',
            params: {
                name: 'non_existent_tool_xyz',
                arguments: {}
            }
        });

        const unkRes = await waitForResponse(6);
        assert.ok(unkRes.error, 'Unknown tool must return JSON-RPC error');
        assert.strictEqual(unkRes.error.code, -32602, 'Must return error code -32602');

    } finally {
        child.kill();
    }
});
