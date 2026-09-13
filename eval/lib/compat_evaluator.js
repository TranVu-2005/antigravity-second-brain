// ==============================================================================
// Antigravity Second Brain: Backward Compatibility & Schema Integrity Evaluator
// Tests 8 Core MCP Tools, 5 Core CLI Commands, and Database Schema Invariance
// ==============================================================================

const path = require('node:path');
const { spawn, execSync } = require('node:child_process');
const { getDB } = require('../../src/db');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MCP_SERVER_PATH = path.join(PROJECT_ROOT, 'mcp_server.js');
const CLI_PATH = path.join(PROJECT_ROOT, 'cli.js');

class CompatibilityEvaluator {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || PROJECT_ROOT;
    }

    /**
     * Verifies SQLite database schema integrity & pragmas.
     */
    async verifyDatabaseIntegrity() {
        const db = getDB();
        const requiredTables = [
            'user_profile',
            'session_state',
            'conversations',
            'episodes',
            'knowledge_items',
            'solutions',
            'entities',
            'entity_relations'
        ];

        const requiredFts = [
            'knowledge_fts',
            'episodes_fts',
            'solutions_fts'
        ];

        const existingTables = db.all("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        const missingFts = requiredFts.filter(t => !existingTables.includes(t));

        const journalMode = db.get("PRAGMA journal_mode;").journal_mode;
        const foreignKeys = db.get("PRAGMA foreign_keys;").foreign_keys;

        const passed = missingTables.length === 0 && missingFts.length === 0;

        return {
            status: passed ? 'PASSED' : 'FAILED',
            journal_mode: journalMode,
            foreign_keys: foreignKeys === 1,
            missing_tables: missingTables,
            missing_fts: missingFts,
            counts: {
                user_profile: db.get("SELECT count(*) as cnt FROM user_profile").cnt,
                knowledge_items: db.get("SELECT count(*) as cnt FROM knowledge_items").cnt,
                solutions: db.get("SELECT count(*) as cnt FROM solutions").cnt,
                episodes: db.get("SELECT count(*) as cnt FROM episodes").cnt,
                conversations: db.get("SELECT count(*) as cnt FROM conversations").cnt,
                entities: db.get("SELECT count(*) as cnt FROM entities").cnt,
                entity_relations: db.get("SELECT count(*) as cnt FROM entity_relations").cnt
            }
        };
    }

    /**
     * Verifies CLI commands execute cleanly with exit code 0.
     */
    async verifyCliCommands() {
        const commands = [
            { name: 'stats', args: ['stats'] },
            { name: 'profile', args: ['profile'] },
            { name: 'search', args: ['search', 'bảo mật'] },
            { name: 'solutions', args: ['solutions'] },
            { name: 'solution', args: ['solution', 'PowerShell'] }
        ];

        const results = [];
        let passedCount = 0;

        for (const cmd of commands) {
            try {
                const fullCmd = `node "${CLI_PATH}" ${cmd.args.join(' ')}`;
                const stdout = execSync(fullCmd, {
                    cwd: this.projectRoot,
                    timeout: 8000,
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore']
                });

                const isSuccess = stdout.length > 0;
                if (isSuccess) passedCount++;

                results.push({
                    name: cmd.name,
                    command: fullCmd,
                    exit_code: 0,
                    passed: isSuccess,
                    output_snippet: stdout.slice(0, 100).replace(/\r?\n/g, ' ')
                });
            } catch (err) {
                results.push({
                    name: cmd.name,
                    command: `node "${CLI_PATH}" ${cmd.args.join(' ')}`,
                    exit_code: err.status || 1,
                    passed: false,
                    error: err.message
                });
            }
        }

        return {
            passed: passedCount === commands.length,
            passed_count: passedCount,
            total_count: commands.length,
            details: results
        };
    }

    /**
     * Verifies MCP tools via stdio JSON-RPC 2.0 communication.
     */
    async verifyMcpTools() {
        return new Promise((resolve) => {
            const child = spawn(process.execPath, [MCP_SERVER_PATH], {
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'ignore']
            });

            let buffer = '';
            const responses = new Map();

            child.stdout.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep last incomplete line

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

            const send = (id, method, params = {}) => {
                const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
                child.stdin.write(msg);
            };

            // 1. Initialize
            send(1, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'eval-runner', version: '2.0' }
            });

            // 2. List tools
            send(2, 'tools/list', {});

            // 3. Call core tools (read-only calls)
            send(3, 'tools/call', { name: 'brain_stats', arguments: {} });
            send(4, 'tools/call', { name: 'brain_profile_get', arguments: {} });
            send(5, 'tools/call', { name: 'brain_search', arguments: { query: 'antigravity', limit: 3 } });
            send(6, 'tools/call', { name: 'brain_conversation_history', arguments: { query: 'antigravity', limit: 3 } });
            send(7, 'tools/call', { name: 'brain_solution_search', arguments: { query: 'powershell', limit: 2 } });
            send(8, 'tools/call', { name: 'brain_git_status', arguments: {} });

            setTimeout(() => {
                try {
                    child.kill();
                } catch (e) {}

                const initRes = responses.get(1);
                const listRes = responses.get(2);
                const statsRes = responses.get(3);
                const profileRes = responses.get(4);
                const searchRes = responses.get(5);
                const histRes = responses.get(6);
                const solRes = responses.get(7);
                const gitRes = responses.get(8);

                const toolsAvailable = listRes && listRes.result && Array.isArray(listRes.result.tools)
                    ? listRes.result.tools.map(t => t.name)
                    : [];

                const requiredTools = [
                    'brain_search',
                    'brain_store',
                    'brain_profile_get',
                    'brain_profile_set',
                    'brain_conversation_history',
                    'brain_stats',
                    'brain_git_backup',
                    'brain_git_status'
                ];

                const missingTools = requiredTools.filter(t => !toolsAvailable.includes(t));
                const callsValid = [statsRes, profileRes, searchRes, histRes, solRes, gitRes]
                    .filter(r => r && r.result && !r.error);

                const passed = initRes && !initRes.error &&
                               missingTools.length === 0 &&
                               callsValid.length >= 5;

                resolve({
                    passed: !!passed,
                    mcp_initialized: !!(initRes && initRes.result),
                    tools_registered_count: toolsAvailable.length,
                    required_tools_present: missingTools.length === 0,
                    missing_required_tools: missingTools,
                    calls_tested: 6,
                    calls_succeeded: callsValid.length
                });
            }, 3000);
        });
    }

    async run() {
        const dbIntegrity = await this.verifyDatabaseIntegrity();
        const cliResults = await this.verifyCliCommands();
        const mcpResults = await this.verifyMcpTools();

        const overallPassed = dbIntegrity.status === 'PASSED' &&
                              cliResults.passed &&
                              mcpResults.passed;

        return {
            status: overallPassed ? 'PASSED' : 'FAILED',
            database_integrity: dbIntegrity,
            cli_commands: cliResults,
            mcp_server: mcpResults
        };
    }
}

module.exports = {
    CompatibilityEvaluator
};
