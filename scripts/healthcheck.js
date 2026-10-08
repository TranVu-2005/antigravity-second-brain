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

        // 2. Verify native node:sqlite support & schema bootstrap
        const { DatabaseSync } = require('node:sqlite');
        const fs = require('node:fs');
        const { SCHEMA_PATH } = require('../src/config');
        if (!fs.existsSync(SCHEMA_PATH)) {
            throw new Error(`Critical schema file missing on disk: ${SCHEMA_PATH}`);
        }
        checks.schemaFileExists = true;

        const memDb = new DatabaseSync(':memory:');
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        memDb.exec(schemaSql);

        // Verify required relational tables exist
        const tables = memDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tableNames = new Set(tables.map(t => t.name));
        for (const reqTable of ['knowledge_items', 'solutions', 'entity_relations', 'memory_events', 'knowledge_fts']) {
            if (!tableNames.has(reqTable)) {
                throw new Error(`Required table/virtual-table missing in schema: ${reqTable}`);
            }
        }
        memDb.close();
        checks.sqlite = true;
        checks.schemaBootstrapped = true;

        // 3. Verify @modelcontextprotocol/sdk and zod
        require('@modelcontextprotocol/sdk/server/index.js');
        require('zod');
        checks.mcpSdk = true;

        // 4. Verify MCP Server Tools schema definition & instance creation
        const { TOOLS, SecondBrainMCPServer } = require('../mcp_server.js');
        if (!Array.isArray(TOOLS) || TOOLS.length !== 14) {
            throw new Error(`Expected 14 registered MCP tools, found: ${TOOLS ? TOOLS.length : 0}`);
        }
        checks.toolsCount = TOOLS.length;

        // Test instantiating server to ensure zero runtime bootstrap crash
        const serverInstance = new SecondBrainMCPServer();
        if (!serverInstance.db || typeof serverInstance.db.all !== 'function') {
            throw new Error('SecondBrainMCPServer failed to initialize internal database');
        }
        checks.serverBootstrapped = true;

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
