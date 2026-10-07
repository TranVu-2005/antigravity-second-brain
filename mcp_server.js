#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Production MCP Server (Model Context Protocol)
// Standard Stdio Transport backed by official @modelcontextprotocol/sdk
// Compatible with Claude Code, Google Antigravity, Cursor, and all MCP Clients
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ErrorCode
} = require('@modelcontextprotocol/sdk/types.js');

const { getDB } = require('./src/db');
const { getProfileManager } = require('./src/profile');
const { getSemanticKnowledge } = require('./src/semantic');
const { getEpisodicMemory } = require('./src/episodic');
const { getSolutionStore } = require('./src/solutions');
const { getGitBackupManager } = require('./src/git_backup');
const { VECTOR_DIM } = require('./src/embedding');
const PKG_VERSION = require('./package.json').version;

const TOOLS = [
    {
        name: 'brain_search',
        description: 'Multi-tiered search across Second Brain: technical knowledge, notes, architectural decisions, and conversation history.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search keywords or natural language query' },
                scope: { 
                    type: 'string', 
                    enum: ['all', 'knowledge', 'conversations'], 
                    description: 'Search scope: all, knowledge, or conversations',
                    default: 'all'
                },
                limit: { type: 'integer', description: 'Maximum number of results to return', default: 5 }
            },
            required: ['query']
        }
    },
    {
        name: 'brain_store',
        description: 'Store a new knowledge item, note, technical solution, or architectural decision into Second Brain.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Brief title of the knowledge item' },
                content: { type: 'string', description: 'Detailed knowledge content to persist' },
                category: { 
                    type: 'string', 
                    enum: ['fact', 'decision', 'snippet', 'rule', 'note', 'concept'], 
                    description: 'Category of the knowledge item',
                    default: 'note' 
                },
                tags: { type: 'string', description: 'Comma-separated classification tags' },
                importance: { type: 'number', description: 'Importance weight (0.5 to 2.0)', default: 1.0 }
            },
            required: ['title', 'content']
        }
    },
    {
        name: 'brain_delete',
        description: 'Delete a knowledge item from Second Brain by its numeric ID.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'integer', description: 'ID of the knowledge item to delete' }
            },
            required: ['id']
        }
    },
    {
        name: 'brain_profile_get',
        description: 'Retrieve full core user profile, identity attributes, tech stack, environment, and preferences.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'brain_profile_set',
        description: 'Update or set a key-value attribute in the user core identity profile.',
        inputSchema: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Fact key (e.g. favorite_lang, work_hours, project_focus)' },
                value: { type: 'string', description: 'Value to set for the key' },
                category: { 
                    type: 'string', 
                    enum: ['identity', 'preference', 'tech_stack', 'environment', 'style', 'general'], 
                    default: 'preference' 
                }
            },
            required: ['key', 'value']
        }
    },
    {
        name: 'brain_conversation_history',
        description: 'Search past conversation sessions and detailed episodic interactions.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Optional search query for conversation history' },
                limit: { type: 'integer', description: 'Maximum number of sessions to return', default: 5 }
            }
        }
    },
    {
        name: 'brain_solution_search',
        description: 'Search learned technical solutions and error remediation recipes in Procedural Memory.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Error message, stack trace snippet, or technical symptom' },
                project_scope: { type: 'string', description: 'Optional project scope filter' },
                limit: { type: 'integer', description: 'Maximum number of solutions to return', default: 3 }
            },
            required: ['query']
        }
    },
    {
        name: 'brain_solution_store',
        description: 'Store an error-solution remediation recipe into Procedural Memory for permanent reuse.',
        inputSchema: {
            type: 'object',
            properties: {
                error_pattern: { type: 'string', description: 'Error signature or symptom string' },
                solution_code: { type: 'string', description: 'Solution explanation or code modification' },
                root_cause: { type: 'string', description: 'Root cause explanation of the error' },
                command_fix: { type: 'string', description: 'Shell command fix if applicable' },
                project_scope: { type: 'string', description: 'Project scope (default: global)', default: 'global' },
                tags: { type: 'string', description: 'Comma-separated classification tags' }
            },
            required: ['error_pattern', 'solution_code']
        }
    },
    {
        name: 'brain_stats',
        description: 'Retrieve operational statistics and health metrics for Second Brain.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'brain_git_backup',
        description: 'Export diffable snapshots and commit memory backup to the Git repository.',
        inputSchema: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'Custom commit message (optional)' }
            }
        }
    },
    {
        name: 'brain_git_status',
        description: 'Inspect Git repository status, current branch, latest commit, and remote configuration.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'brain_remember',
        description: 'Actively record a new fact, preference, rule, or entity relationship into memory (Letta-style Active Memory).',
        inputSchema: {
            type: 'object',
            properties: {
                text: { type: 'string', description: 'Factual statement or knowledge text to remember' },
                category: { 
                    type: 'string', 
                    enum: ['fact', 'preference', 'rule', 'tech_stack', 'entity_relation'],
                    description: 'Knowledge category (default: preference)',
                    default: 'preference'
                },
                key: { type: 'string', description: 'Identifier key (optional, auto-generated if omitted)' },
                relation: {
                    type: 'object',
                    description: 'Entity relation details (if category is entity_relation)',
                    properties: {
                        source: { type: 'string', description: 'Source entity name' },
                        predicate: { type: 'string', description: 'Relation predicate (e.g. prefers, uses, located_in)' },
                        target: { type: 'string', description: 'Target entity name' }
                    }
                }
            },
            required: ['text']
        }
    },
    {
        name: 'brain_forget',
        description: 'Actively remove, revoke, or expire obsolete memory, entity relations, or knowledge items (Letta-style Active Forgetting).',
        inputSchema: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Profile key to delete, or entity/knowledge title' },
                target: { type: 'string', description: 'Target entity name if expiring a relationship (optional)' },
                reason: { type: 'string', description: 'Reason for removal or obsolescence (optional)' }
            },
            required: ['key']
        }
    },
    {
        name: 'brain_learn_fix',
        description: 'Actively record a verified command fix or troubleshooting solution into Procedural Memory.',
        inputSchema: {
            type: 'object',
            properties: {
                error_pattern: { type: 'string', description: 'Error signature or identifier' },
                solution_code: { type: 'string', description: 'Detailed troubleshooting solution' },
                command_fix: { type: 'string', description: 'Exact shell command that resolved the issue (optional)' },
                root_cause: { type: 'string', description: 'Root cause explanation (optional)' },
                project_scope: { type: 'string', description: 'Project scope (default: global)', default: 'global' }
            },
            required: ['error_pattern', 'solution_code']
        }
    }
];

class SecondBrainMCPServer {
    constructor() {
        this.profile = getProfileManager();
        this.semantic = getSemanticKnowledge();
        this.episodic = getEpisodicMemory();
        this.solutions = getSolutionStore();
        this.gitBackup = getGitBackupManager();
        this.db = getDB();

        this.server = new Server(
            {
                name: 'antigravity-second-brain',
                version: PKG_VERSION
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        this._registerHandlers();
    }

    _registerHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: TOOLS
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return await this.executeTool(name, args || {});
        });
    }

    async executeTool(name, args) {
        switch (name) {
            case 'brain_search': {
                const query = args.query || '';
                const scope = args.scope || 'all';
                const limit = args.limit || 5;

                const results = [];

                if (scope === 'all' || scope === 'knowledge') {
                    const kn = await this.semantic.searchKnowledge(query, { limit });
                    for (const k of kn) {
                        results.push(`[Tri thức #${k.id} | ${k.category.toUpperCase()}] ${k.title}\n${k.content}\nTags: ${k.tags || 'none'} (Score: ${k.score})`);
                    }
                }

                if (scope === 'all' || scope === 'conversations') {
                    const ep = this.episodic.searchEpisodes(query, limit);
                    for (const e of ep) {
                        results.push(`[Hội thoại | ${e.timestamp.split('T')[0]}] [${e.conv_title || 'Session'}] ${e.role.toUpperCase()}: ${e.content.slice(0, 300)}`);
                    }
                }

                const resultText = results.length > 0 
                    ? `Found ${results.length} matching results:\n\n` + results.join('\n\n---\n\n')
                    : `No results found matching query "${query}".`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_store': {
                const insertId = await this.semantic.addItem({
                    title: args.title,
                    content: args.content,
                    category: args.category || 'note',
                    tags: args.tags || '',
                    source: 'agent_mcp',
                    importance: args.importance || 1.0
                });
                return { content: [{ type: 'text', text: `Successfully stored in Second Brain with ID #${insertId} (Title: "${args.title}").` }] };
            }

            case 'brain_delete': {
                const success = this.semantic.deleteItem(args.id);
                const resultText = success ? `Successfully deleted knowledge item ID #${args.id}.` : `Could not delete item ID #${args.id}.`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_profile_get': {
                const facts = this.profile.getAll();
                const resultText = `=== USER IDENTITY & CORE PROFILE ===\n\n` + 
                    facts.map(f => `• [${f.category}] ${f.key}: ${f.value} (Source: ${f.source})`).join('\n');
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_profile_set': {
                this.profile.setFact(args.key, args.value, args.category || 'preference', 1.0, 'user_update');
                return { content: [{ type: 'text', text: `Successfully updated user profile: ${args.key} = "${args.value}".` }] };
            }

            case 'brain_conversation_history': {
                const query = args.query;
                const limit = args.limit || 5;
                let resultText = '';
                if (query) {
                    const ep = this.episodic.searchEpisodes(query, limit);
                    resultText = `Conversation history search results for "${query}":\n\n` +
                        ep.map(e => `• [${e.timestamp}] ${e.role}: ${e.summary}`).join('\n');
                } else {
                    const convs = this.episodic.getConversations(limit);
                    resultText = `Recent conversation sessions:\n\n` +
                        convs.map(c => `• [${c.id.slice(0, 8)}] "${c.title}" (${c.message_count} messages, updated: ${c.updated_at})`).join('\n');
                }
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_solution_search': {
                const query = args.query || '';
                const projectScope = args.project_scope || null;
                const limit = args.limit || 3;
                const sols = this.solutions.searchSolutions(query, { project_scope: projectScope, limit });

                const resultText = sols.length > 0
                    ? `Found ${sols.length} learned technical solutions:\n\n` + 
                      sols.map(s => `• Error: "${s.error_pattern}"\n  Root Cause: ${s.root_cause || 'N/A'}\n  Solution: ${s.solution_code}${s.command_fix ? `\n  Command: ${s.command_fix}` : ''}\n  (Confidence: ${Math.round(s.confidence * 100)}%, Fixes: ${s.success_count})`).join('\n\n---\n\n')
                    : `No solutions found in Procedural Memory for error pattern "${query}".`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_solution_store': {
                const id = this.solutions.addSolution({
                    error_pattern: args.error_pattern,
                    solution_code: args.solution_code,
                    root_cause: args.root_cause || '',
                    command_fix: args.command_fix || '',
                    project_scope: args.project_scope || 'global',
                    tags: args.tags || 'manual_entry'
                });
                return { content: [{ type: 'text', text: `Successfully stored solution into Procedural Memory with ID #${id}.` }] };
            }

            case 'brain_stats': {
                const knCount = this.db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
                const epCount = this.db.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
                const convCount = this.db.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
                const profCount = this.db.get('SELECT COUNT(*) as cnt FROM user_profile').cnt;
                const solCount = this.db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;
                const embRow = this.db.get('SELECT length(embedding) as len FROM knowledge_items WHERE embedding IS NOT NULL LIMIT 1');
                const actualDim = (embRow && embRow.len) ? (embRow.len / 4) : VECTOR_DIM;
                const dbPath = path.join(__dirname, 'brain.db');
                const dbSize = fs.existsSync(dbPath) ? `${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB` : 'N/A';

                const resultText = `=== ANTIGRAVITY SECOND BRAIN STATS (v${PKG_VERSION} Production-Grade) ===\n` +
                    `• User Profile Attributes: ${profCount} items\n` +
                    `• Long-Term Knowledge Items: ${knCount} items\n` +
                    `• Procedural Solutions: ${solCount} items\n` +
                    `• Episodic Message Logs: ${epCount} events\n` +
                    `• Total Conversations: ${convCount} sessions\n` +
                    `• Vector Space: ${actualDim}-dim Dense Vectors (${embRow && embRow.len ? embRow.len : 0} bytes/record)\n` +
                    `• Database Engine: SQLite WAL mode + FTS5 BM25 (Size: ${dbSize})\n` +
                    `• Status: Ready and Operational`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_git_backup': {
                const res = this.gitBackup.commitBackup(args.message || null);
                let resultText = '';
                if (!res.success) {
                    resultText = `❌ Git Backup Failed: ${res.error}`;
                } else if (res.committed) {
                    resultText = `✅ Git Backup commit created successfully!\n• Commit: ${res.commit}\n• Stats: ${res.stats.profileCount} profile, ${res.stats.knowledgeCount} knowledge, ${res.stats.solutionsCount} solutions, ${res.stats.conversationsCount} convs.`;
                } else {
                    resultText = `ℹ️ ${res.message}\n• Data is currently synchronized with zero uncommitted changes.`;
                }
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_git_status': {
                const st = this.gitBackup.getStatus();
                let resultText = '';
                if (!st.gitAvailable) {
                    resultText = `❌ Git is not available: ${st.error}`;
                } else if (!st.initialized) {
                    resultText = `⚠️ Git repository not initialized. Run brain_git_backup to initialize.`;
                } else {
                    resultText = `=== SECOND BRAIN GIT STATUS ===\n` +
                        `• Git Version: ${st.version}\n` +
                        `• Current Branch: ${st.branch}\n` +
                        `• Latest Commit: ${st.lastCommit}\n` +
                        `• Remote URL: ${st.remoteUrl || 'Local only (no remote configured)'}\n` +
                        `• Uncommitted Files: ${st.uncommittedCount}`;
                }
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_remember': {
                const text = args.text || args.value || '';
                const category = args.category || 'preference';
                let key = args.key || args.identifier || null;

                if (!key) {
                    key = text.toLowerCase()
                        .replace(/[^\w\s]/g, '')
                        .trim()
                        .split(/\s+/)
                        .slice(0, 4)
                        .join('_');
                }

                if (category === 'preference' || category === 'fact' || category === 'tech_stack' || category === 'test') {
                    this.profile.setFact(key, text, category, 1.0, 'agent_remember');
                }

                // Also store as semantic knowledge for neural retrieval
                const insertId = await this.semantic.addItem({
                    title: text.slice(0, 50),
                    content: text,
                    category: category === 'rule' ? 'rule' : 'fact',
                    tags: args.tags || category,
                    source: 'agent_remember',
                    importance: 1.5
                });

                // If relation is provided, also add to Knowledge Graph
                if (args.relation && args.relation.source && args.relation.predicate && args.relation.target) {
                    this.semantic.addRelation(args.relation.source, args.relation.predicate, args.relation.target, { confidence: 1.0 });
                }

                const resultText = `Successfully recorded memory (Letta-style): Key "${key}" into Profile, Semantic Knowledge (ID #${insertId})${args.relation ? ' and Entity Graph' : ''}.`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_forget': {
                const key = args.key || args.identifier || '';
                const target = args.target || null;
                const reason = args.reason || 'User requested forgetting or obsolete';

                let deletedProfile = false;
                if (this.profile.get(key)) {
                    this.profile.deleteFact(key);
                    deletedProfile = true;
                }

                // If target specified, expire entity relation
                let expiredRel = false;
                if (target) {
                    expiredRel = this.semantic.expireRelation(key, 'prefers', target) ||
                                 this.semantic.expireRelation(key, 'uses', target) ||
                                 this.semantic.expireRelation(key, 'located_in', target);
                }

                // Cascade forget to Semantic Knowledge Items
                let deletedKnowledge = false;
                try {
                    const knMatches = this.db.all('SELECT id FROM knowledge_items WHERE title = ? OR title LIKE ? OR tags LIKE ?', key, `%${key}%`, `%${key}%`);
                    for (const km of knMatches) {
                        this.semantic.deleteItem(km.id);
                        deletedKnowledge = true;
                    }
                } catch (e) {}

                // Cascade forget to Procedural Solutions
                let deletedSolution = false;
                try {
                    const solMatches = this.db.all('SELECT id FROM solutions WHERE error_pattern = ? OR error_pattern LIKE ?', key, `%${key}%`);
                    for (const sm of solMatches) {
                        this.solutions.deleteSolution(sm.id);
                        deletedSolution = true;
                    }
                } catch (e) {}

                const resultText = `Comprehensive removal completed (Letta-style): ` +
                    `${deletedProfile ? `Profile key "${key}" removed. ` : ''}` +
                    `${deletedKnowledge ? `Semantic knowledge "${key}" removed from DB and FTS. ` : ''}` +
                    `${deletedSolution ? `Procedural solution "${key}" removed. ` : ''}` +
                    `${expiredRel ? `Entity relation with "${target}" expired. ` : ''}` +
                    `(Reason: ${reason})`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            case 'brain_learn_fix': {
                const id = this.solutions.addSolution({
                    error_pattern: args.error_pattern,
                    solution_code: args.solution_code,
                    command_fix: args.command_fix || args.solution_code,
                    root_cause: args.root_cause || '',
                    project_scope: args.project_scope || 'global',
                    tags: 'learned_fix,agent_self_edit'
                });
                const resultText = `Successfully learned error fix into Procedural Memory (ID #${id}): "${args.error_pattern}".`;
                return { content: [{ type: 'text', text: resultText }] };
            }

            default:
                throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
        }
    }

    async start() {
        // Automatically ensure neural embedding daemon is running
        try {
            const { ensureDaemonRunning } = require('./src/embedding');
            ensureDaemonRunning();
        } catch (e) {}

        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}

if (require.main === module) {
    const server = new SecondBrainMCPServer();
    server.start().catch((err) => {
        console.error('Fatal MCP Server Error:', err);
        process.exit(1);
    });
}

module.exports = { 
    SecondBrainMCPServer,
    TOOLS,
    PKG_VERSION
};
