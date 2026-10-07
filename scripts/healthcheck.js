#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Container & System Healthcheck
// Verifies runtime integrity, node:sqlite support, and MCP tool availability.
// ==============================================================================

const path = require('node:path');

function runHealthcheck() {
    const checks = {
        nodeVersion: process.version,
        sqlite: false,
        mcpSdk: false,
        toolsCount: 0,
        status: 'unhealthy'
    };

    try {
        // 1. Verify Node.js version
        const [major, minor] = process.versions.node.split('.').map(Number);
        if (major < 22 || (major === 22 && minor < 5)) {
            throw new Error(`Node.js >= 22.5.0 required, current: ${process.version}`);
        }

        // 2. Verify native node:sqlite support
        const { DatabaseSync } = require('node:sqlite');
        const memDb = new DatabaseSync(':memory:');
        memDb.exec('CREATE TABLE _hc (id INT); INSERT INTO _hc VALUES (1);');
        const res = memDb.prepare('SELECT COUNT(*) as c FROM _hc').get();
        memDb.close();
        if (res.c !== 1) throw new Error('node:sqlite memory verification failed');
        checks.sqlite = true;

        // 3. Verify @modelcontextprotocol/sdk and zod
        require('@modelcontextprotocol/sdk/server/index.js');
        require('zod');
        checks.mcpSdk = true;

        // 4. Verify MCP Server Tools schema definition
        const { TOOLS } = require('../mcp_server.js');
        if (!Array.isArray(TOOLS) || TOOLS.length !== 14) {
            throw new Error(`Expected 14 registered MCP tools, found: ${TOOLS ? TOOLS.length : 0}`);
        }
        checks.toolsCount = TOOLS.length;

        checks.status = 'healthy';
        process.stdout.write(JSON.stringify(checks, null, 2) + '\n');
        process.exit(0);
    } catch (err) {
        checks.error = err.message;
        process.stderr.write(JSON.stringify(checks, null, 2) + '\n');
        process.exit(1);
    }
}

runHealthcheck();
