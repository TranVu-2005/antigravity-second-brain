// ==============================================================================
// Antigravity Second Brain: Tier 4.5 - Cognitive Memory Consolidation Engine
// Summarizes past conversations, resolves contradictions, and prunes temporary facts
// ==============================================================================

const { getDB } = require('./db');

class MemoryConsolidator {
    constructor(db = getDB()) {
        this.db = db;
    }

    consolidate() {
        const stats = {
            summarizedConversations: 0,
            deduplicatedItems: 0,
            resolvedContradictions: 0,
            prunedItems: 0,
            decayedItems: 0,
            optimized: false
        };

        // 1. Summarize Past Conversations (Episodic Consolidation)
        const unsummarizedConvs = this.db.all(`
            SELECT c.id, c.title, c.message_count, c.summary
            FROM conversations c
            WHERE (c.summary IS NULL OR length(c.summary) < 20)
              AND c.message_count >= 2
        `);

        for (const conv of unsummarizedConvs) {
            const episodes = this.db.all(`
                SELECT role, summary, content, timestamp 
                FROM episodes 
                WHERE conversation_id = ? 
                ORDER BY step_index ASC
            `, conv.id);

            if (episodes.length > 0) {
                const userPrompts = episodes
                    .filter(e => e.role === 'user')
                    .map(e => e.summary.replace(/[\r\n]+/g, ' ').trim())
                    .filter(Boolean);

                const assistantKeyPoints = episodes
                    .filter(e => e.role === 'assistant')
                    .slice(0, 3)
                    .map(e => e.summary.slice(0, 120).replace(/[\r\n]+/g, ' ').trim());

                const autoSummary = `Phiên trao đổi tập trung vào: "${userPrompts.slice(0, 3).join('; ')}". Kết quả chính: ${assistantKeyPoints.join('. ')}.`;
                const takeaways = JSON.stringify(userPrompts.slice(0, 5));

                this.db.run(`
                    UPDATE conversations 
                    SET summary = ?, key_takeaways = ?, updated_at = datetime('now')
                    WHERE id = ?
                `, autoSummary, takeaways, conv.id);

                stats.summarizedConversations++;
            }
        }

        // 2. Contradiction Resolution & Deduplication for Knowledge Items
        const duplicates = this.db.all(`
            SELECT LOWER(TRIM(title)) as norm_title, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
            FROM knowledge_items
            GROUP BY LOWER(TRIM(title))
            HAVING cnt > 1
        `);

        for (const dup of duplicates) {
            const idList = dup.ids.split(',').map(Number);
            const primaryId = idList[idList.length - 1]; // Keep latest
            const obsoleteIds = idList.slice(0, idList.length - 1);

            for (const obsId of obsoleteIds) {
                this.db.run('DELETE FROM knowledge_items WHERE id = ?', obsId);
                stats.deduplicatedItems++;
                stats.resolvedContradictions++;
            }
        }

        // 3. Temporal Memory Decay (Ephemeral facts like weather decay after 48 hours)
        const decayThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const decayResult = this.db.run(`
            UPDATE knowledge_items 
            SET importance = MAX(0.2, importance * 0.5)
            WHERE (tags LIKE '%weather%' OR tags LIKE '%thoi_tiet%' OR category = 'temporary')
              AND updated_at < ?
              AND importance > 0.3
        `, decayThreshold);
        stats.decayedItems = decayResult.changes || 0;

        // 4. Prune Obsolete Expired Memories (importance < 0.3 and older than 30 days)
        const pruneThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const pruneResult = this.db.run(`
            DELETE FROM knowledge_items 
            WHERE importance <= 0.3 
              AND access_count = 0 
              AND updated_at < ?
        `, pruneThreshold);
        stats.prunedItems = pruneResult.changes || 0;

        // 5. Defragment & Optimize SQLite DB
        try {
            this.db.exec(`
                PRAGMA optimize;
                PRAGMA wal_checkpoint(TRUNCATE);
            `);
            stats.optimized = true;
        } catch (e) {
            stats.optimized = false;
        }

        return stats;
    }
}

let instance = null;

function getMemoryConsolidator(db = getDB()) {
    if (!instance) {
        instance = new MemoryConsolidator(db);
    }
    return instance;
}

module.exports = {
    MemoryConsolidator,
    getMemoryConsolidator
};
