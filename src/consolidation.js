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

        // 3. Ebbinghaus Forgetting Curve Decay with Spaced-Repetition Stability
        // Stability S = S0 * (1.0 + 0.2 * access_count)^0.5
        // S0: rule/identity=10000d, decision/solution=180d, fact/concept=60d, project/active=14d, other=2d
        // R(t) = exp(-delta_t / S)
        const decayResult = this.db.run(`
            UPDATE knowledge_items 
            SET importance = MAX(0.1, ROUND(
                importance * exp(
                    - (julianday('now') - julianday(updated_at)) / 
                    (
                        CASE 
                            WHEN category IN ('rule', 'identity') THEN 10000.0
                            WHEN category IN ('decision', 'solution') THEN 180.0
                            WHEN category IN ('fact', 'concept') THEN 60.0
                            WHEN category IN ('project', 'active') THEN 14.0
                            ELSE 2.0
                        END * (1.0 + 0.2 * access_count)
                    )
                ), 
                3
            ))
            WHERE category NOT IN ('rule', 'identity')
              AND (julianday('now') - julianday(updated_at)) > 0.05
        `);
        stats.decayedItems = decayResult.changes || 0;

        // 4. Safe Spaced-Repetition Pruning (importance < 0.25, access_count <= 1, older than 60 days)
        const pruneResult = this.db.run(`
            DELETE FROM knowledge_items 
            WHERE importance < 0.25 
              AND access_count <= 1 
              AND category NOT IN ('rule', 'identity')
              AND updated_at < datetime('now', '-60 days')
        `);
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
