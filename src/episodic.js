// ==============================================================================
// Antigravity Second Brain: Tier 2 - Episodic Memory Engine
// Ingests, indexes and retrieves conversation transcripts & historic interactions
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getDB } = require('./db');

const os = require('node:os');
const DEFAULT_ANTIGRAVITY_BRAIN_DIR = process.env.ANTIGRAVITY_BRAIN_DIR || path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

class EpisodicMemory {
    constructor(db = getDB(), brainDir = DEFAULT_ANTIGRAVITY_BRAIN_DIR) {
        this.db = db;
        this.brainDir = brainDir;
    }

    cleanUserContent(raw) {
        if (!raw) return '';
        let cleaned = raw;
        // Strip XML-like tags like <USER_REQUEST>, <ADDITIONAL_METADATA>
        cleaned = cleaned.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '');
        cleaned = cleaned.replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '');
        cleaned = cleaned.replace(/<USER_REQUEST>/gi, '').replace(/<\/USER_REQUEST>/gi, '');
        return cleaned.trim();
    }

    ingestTranscriptFile(transcriptPath, conversationId = null) {
        if (!fs.existsSync(transcriptPath)) return 0;

        if (!conversationId) {
            // Infer from path: .../brain/<conversationId>/.system_generated/logs/transcript.jsonl
            const parts = transcriptPath.split(/[\\/]/);
            const brainIdx = parts.findIndex(p => p === 'brain');
            if (brainIdx !== -1 && parts.length > brainIdx + 1) {
                conversationId = parts[brainIdx + 1];
            } else {
                conversationId = path.basename(path.dirname(transcriptPath));
            }
        }

        // Get or create conversation record
        let conv = this.db.get('SELECT * FROM conversations WHERE id = ?', conversationId);
        if (!conv) {
            this.db.run(`
                INSERT INTO conversations (id, title, created_at, updated_at, message_count, last_step_index)
                VALUES (?, ?, datetime('now'), datetime('now'), 0, -1)
            `, conversationId, `Conversation ${conversationId.slice(0, 8)}`);
            conv = { last_step_index: -1, message_count: 0 };
        }
        conv._initial_last_step_index = conv.last_step_index;

        const rawContent = fs.readFileSync(transcriptPath, 'utf8');
        const lines = rawContent.trim().split('\n');
        let newEpisodes = 0;
        let convTitle = null;

        const pendingEpisodes = [];
        for (const line of lines) {
            if (!line.trim()) continue;
            let step;
            try {
                step = JSON.parse(line);
            } catch (e) {
                continue;
            }

            const stepIdx = typeof step.step_index === 'number' ? step.step_index : 0;
            if (stepIdx <= conv.last_step_index) {
                continue; // Already processed
            }

            let role = 'system';
            let content = '';
            let summary = '';
            let tags = [];

            if (step.type === 'USER_INPUT') {
                role = 'user';
                content = this.cleanUserContent(step.content);
                summary = content.slice(0, 160);
                tags.push('user_prompt');

                if (!convTitle && content.length > 0) {
                    convTitle = content.slice(0, 80).replace(/[\r\n]+/g, ' ');
                }
            } else if (step.type === 'PLANNER_RESPONSE') {
                role = 'assistant';
                if (step.content) {
                    content = step.content;
                    summary = step.content.slice(0, 200).replace(/[\r\n]+/g, ' ');
                    tags.push('response');
                } else if (step.tool_calls && step.tool_calls.length > 0) {
                    const toolNames = step.tool_calls.map(tc => tc.name || tc.toolAction || 'tool').join(', ');
                    content = `Tool execution: ${toolNames}`;
                    summary = `Called tools: ${toolNames}`;
                    tags.push('tool_call');
                }
            }

            if (content) {
                const timestamp = step.created_at || new Date().toISOString();
                pendingEpisodes.push([conversationId, stepIdx, role, content, summary, tags.join(','), timestamp]);
            }
            conv.last_step_index = Math.max(conv.last_step_index, stepIdx);
        }

        if (pendingEpisodes.length > 0) {
            const insertStmt = this.db.prepare(`
                INSERT INTO episodes (conversation_id, step_index, role, content, summary, tags, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            this.db.transaction(() => {
                for (const p of pendingEpisodes) {
                    insertStmt.run(...p);
                }
            });
            newEpisodes = pendingEpisodes.length;
        }

        if (newEpisodes > 0 || conv.last_step_index > (conv._initial_last_step_index || -1)) {
            const totalCount = this.db.get('SELECT COUNT(*) as cnt FROM episodes WHERE conversation_id = ?', conversationId).cnt;
            const updateTitleSql = convTitle ? ', title = ?' : '';
            const params = convTitle 
                ? [totalCount, conv.last_step_index, new Date().toISOString(), convTitle, conversationId]
                : [totalCount, conv.last_step_index, new Date().toISOString(), conversationId];

            this.db.run(`
                UPDATE conversations 
                SET message_count = ?, last_step_index = ?, updated_at = ? ${updateTitleSql}
                WHERE id = ?
            `, ...params);
        }

        return newEpisodes;
    }

    syncAllConversations(brainRoot = this.brainDir) {
        if (!fs.existsSync(brainRoot)) return { syncedConversations: 0, totalNewEpisodes: 0 };

        const entries = fs.readdirSync(brainRoot, { withFileTypes: true });
        let syncedConversations = 0;
        let totalNewEpisodes = 0;

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const convId = entry.name;
                const transcriptPath = path.join(brainRoot, convId, '.system_generated', 'logs', 'transcript.jsonl');
                if (fs.existsSync(transcriptPath)) {
                    const added = this.ingestTranscriptFile(transcriptPath, convId);
                    totalNewEpisodes += added;
                    syncedConversations++;
                }
            }
        }

        return { syncedConversations, totalNewEpisodes };
    }

    searchEpisodes(query, limit = 5) {
        if (!query || !query.trim()) return [];
        // Sanitize query for FTS5
        const sanitized = query.replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ').trim();
        if (!sanitized) return [];

        // FTS5 phrase or prefix query
        const ftsQuery = sanitized.split(/\s+/).filter(Boolean).map(w => `"${w}"*`).join(' OR ');

        try {
            const rows = this.db.all(`
                SELECT e.id, e.conversation_id, e.role, e.summary, e.content, e.timestamp,
                       bm25(episodes_fts) as rank, c.title as conv_title
                FROM episodes_fts
                JOIN episodes e ON episodes_fts.rowid = e.id
                JOIN conversations c ON e.conversation_id = c.id
                WHERE episodes_fts MATCH ?
                ORDER BY rank ASC, e.timestamp DESC
                LIMIT ?
            `, ftsQuery, limit);
            return rows;
        } catch (e) {
            // Fallback to LIKE if FTS fails
            const likePattern = `%${sanitized}%`;
            return this.db.all(`
                SELECT e.id, e.conversation_id, e.role, e.summary, e.content, e.timestamp,
                       0 as rank, c.title as conv_title
                FROM episodes e
                JOIN conversations c ON e.conversation_id = c.id
                WHERE e.content LIKE ? OR e.summary LIKE ?
                ORDER BY e.timestamp DESC
                LIMIT ?
            `, likePattern, likePattern, limit);
        }
    }

    getRecentEpisodes(limit = 6) {
        return this.db.all(`
            SELECT e.id, e.conversation_id, e.role, e.summary, e.content, e.timestamp, c.title as conv_title
            FROM episodes e
            JOIN conversations c ON e.conversation_id = c.id
            ORDER BY e.timestamp DESC
            LIMIT ?
        `, limit);
    }

    getConversations(limit = 10) {
        return this.db.all(`
            SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?
        `, limit);
    }

    catchUpRecentSessions(maxSessions = 3, autoDistill = false) {
        if (!fs.existsSync(this.brainDir)) return { checked: 0, newEpisodes: 0 };
        let newEpisodes = 0;
        let checked = 0;

        try {
            const entries = fs.readdirSync(this.brainDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && d.name !== 'tempmediaStorage' && !d.name.startsWith('.'))
                .map(d => {
                    const full = path.join(this.brainDir, d.name);
                    let mtime = 0;
                    try { mtime = fs.statSync(full).mtimeMs; } catch (e) {}
                    return { id: d.name, path: full, mtime };
                })
                .sort((a, b) => b.mtime - a.mtime)
                .slice(0, maxSessions);

            checked = entries.length;

            for (const entry of entries) {
                const transcriptPath = path.join(entry.path, '.system_generated', 'logs', 'transcript.jsonl');
                if (!fs.existsSync(transcriptPath)) continue;

                const count = this.ingestTranscriptFile(transcriptPath, entry.id);
                if (count > 0) newEpisodes += count;

                if (autoDistill) {
                    const conv = this.db.get('SELECT last_step_index, summary FROM conversations WHERE id = ?', entry.id);
                    if (!conv || !conv.summary || !conv.summary.startsWith('[Mục tiêu:') || count > 0) {
                        try {
                            const { getMemoryConsolidator } = require('./consolidation');
                            const consolidator = getMemoryConsolidator(this.db);
                            consolidator.distillSession(entry.id);
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {}

        return { checked, newEpisodes };
    }
}

let instance = null;

function getEpisodicMemory(db = getDB(), brainDir = DEFAULT_ANTIGRAVITY_BRAIN_DIR) {
    if (!instance) {
        instance = new EpisodicMemory(db, brainDir);
    }
    return instance;
}

module.exports = {
    EpisodicMemory,
    getEpisodicMemory
};
