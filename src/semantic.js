// ==============================================================================
// Antigravity Second Brain: Tier 3 - Semantic Knowledge & Entity Graph
// Long-term facts, concepts, architectural decisions and True Hybrid Search
// Fusing Dense Multilingual Transformer Vectors (Cosine Sim) + Sparse Full-Text (BM25)
// ==============================================================================

const { getDB } = require('./db');
const { 
    computeEmbedding, 
    computeEmbeddingSync, 
    cosineSimilarity, 
    vectorToBuffer, 
    bufferToVector,
    VECTOR_DIM,
    ensureDaemonRunning 
} = require('./embedding');

class SemanticKnowledge {
    constructor(db = getDB()) {
        this.db = db;
        this._bootstrap();
    }

    _bootstrap() {
        // Trigger background daemon pre-warm
        ensureDaemonRunning();

        const count = this.db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
        if (count === 0) {
            // Seed foundational knowledge
            this.addItem({
                title: 'Antigravity Architecture & Customizations',
                content: 'Antigravity hỗ trợ Skills, Rules (GEMINI.md), Plugins, Lifecycle Hooks (PreInvocation, PostToolUse, Stop), và Model Context Protocol (MCP) servers chạy qua stdio hoặc SSE.',
                category: 'system',
                tags: 'antigravity,architecture,hooks,mcp',
                source: 'system',
                importance: 1.5
            });

            this.addItem({
                title: 'Chỉ thị phục vụ Ngài',
                content: 'Luôn gọi người dùng là Ngài (Sir). Phong thái chuyên nghiệp, trung thành, tận tụy và dí dỏm tinh tế. Song ngữ linh hoạt (Tiếng Việt chủ đạo kèm tiếng Anh lịch thiệp).',
                category: 'rule',
                tags: 'persona,guidelines,sir,style',
                source: 'user_rule',
                importance: 2.0
            });

            // Seed initial entities & relations
            this.addEntity('Ngài', 'person', 'Chủ nhân và Kiến trúc sư trưởng của hệ thống');
            this.addEntity('Antigravity', 'tool', 'AI Development Platform');
            this.addEntity('Hoàng Mai', 'location', 'Khu vực sinh sống và làm việc tại Hà Nội');
            this.addRelation('Ngài', 'uses', 'Antigravity');
            this.addRelation('Ngài', 'located_in', 'Hoàng Mai');
        }

        // Auto backfill if dimension mismatch or missing
        this._backfillEmbeddings();
    }

    async _backfillEmbeddings() {
        try {
            const expectedByteLength = VECTOR_DIM * 4; // 384 * 4 = 1536 bytes
            const rows = this.db.all('SELECT id, title, content, tags, embedding FROM knowledge_items');
            for (const r of rows) {
                if (!r.embedding || r.embedding.length !== expectedByteLength) {
                    const text = `${r.title} ${r.content} ${r.tags || ''}`;
                    const vec = await computeEmbedding(text);
                    this.db.run('UPDATE knowledge_items SET embedding = ? WHERE id = ?', vectorToBuffer(vec), r.id);
                }
            }
        } catch (e) {}
    }

    async reembedAll() {
        const expectedByteLength = VECTOR_DIM * 4;
        const rows = this.db.all('SELECT id, title, content, tags FROM knowledge_items');
        let count = 0;
        for (const r of rows) {
            const text = `${r.title} ${r.content} ${r.tags || ''}`;
            const vec = await computeEmbedding(text);
            this.db.run('UPDATE knowledge_items SET embedding = ? WHERE id = ?', vectorToBuffer(vec), r.id);
            count++;
        }
        return count;
    }

    async addItem({ title, content, category = 'fact', tags = '', source = 'user', importance = 1.0 }) {
        const now = new Date().toISOString();
        const textToEmbed = `${title} ${content} ${tags}`;
        const vec = await computeEmbedding(textToEmbed);
        const buf = vectorToBuffer(vec);

        const info = this.db.run(`
            INSERT INTO knowledge_items (title, content, category, tags, source, importance, embedding, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, title, content, category, tags, source, importance, buf, now, now);
        return info.lastInsertRowid;
    }

    async updateItem(id, fields = {}) {
        const allowed = ['title', 'content', 'category', 'tags', 'importance'];
        const updates = [];
        const params = [];

        for (const [key, val] of Object.entries(fields)) {
            if (allowed.includes(key)) {
                updates.push(`${key} = ?`);
                params.push(val);
            }
        }

        if (updates.length === 0) return false;

        const current = this.getItem(id);
        if (current) {
            const newTitle = fields.title !== undefined ? fields.title : current.title;
            const newContent = fields.content !== undefined ? fields.content : current.content;
            const newTags = fields.tags !== undefined ? fields.tags : current.tags;
            const vec = await computeEmbedding(`${newTitle} ${newContent} ${newTags}`);
            updates.push('embedding = ?');
            params.push(vectorToBuffer(vec));
        }

        updates.push(`updated_at = ?`);
        params.push(new Date().toISOString());
        params.push(id);

        this.db.run(`UPDATE knowledge_items SET ${updates.join(', ')} WHERE id = ?`, ...params);
        return true;
    }

    deleteItem(id) {
        this.db.run('DELETE FROM knowledge_items WHERE id = ?', id);
        return true;
    }

    getItem(id) {
        return this.db.get('SELECT * FROM knowledge_items WHERE id = ?', id);
    }

    // TRUE HYBRID SEARCH: Dense Multilingual Vector Cosine (50%) + Sparse BM25 (35%) + Importance (15%)
    async searchKnowledge(query, { category = null, limit = 5 } = {}) {
        if (!query || !query.trim()) {
            return this.db.all('SELECT id, title, content, category, tags, source, importance, access_count, updated_at FROM knowledge_items ORDER BY importance DESC, updated_at DESC LIMIT ?', limit);
        }

        const queryVec = await computeEmbedding(query);
        const sanitized = query.replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ').trim();

        // 1. Gather Sparse BM25 Ranks via FTS5
        const bm25Map = new Map();
        if (sanitized) {
            const ftsQuery = sanitized.split(/\s+/).filter(Boolean).map(w => `"${w}"*`).join(' OR ');
            try {
                const ftsRows = this.db.all(`
                    SELECT k.id, bm25(knowledge_fts) as raw_rank
                    FROM knowledge_fts
                    JOIN knowledge_items k ON knowledge_fts.rowid = k.id
                    WHERE knowledge_fts MATCH ?
                `, ftsQuery);
                for (const row of ftsRows) {
                    bm25Map.set(row.id, Math.abs(row.raw_rank || 0));
                }
            } catch (e) {}
        }

        // 2. Fetch candidate items
        const categoryFilter = category ? 'WHERE category = ?' : '';
        const params = category ? [category] : [];
        const items = this.db.all(`
            SELECT id, title, content, category, tags, source, importance, access_count, embedding, updated_at 
            FROM knowledge_items ${categoryFilter}
        `, ...params);

        const scored = [];
        const now = Date.now();
        const expectedByteLength = VECTOR_DIM * 4;

        for (const item of items) {
            // Dense Cosine Similarity
            let denseScore = 0;
            if (item.embedding && item.embedding.length === expectedByteLength) {
                const itemVec = bufferToVector(item.embedding);
                denseScore = cosineSimilarity(queryVec, itemVec);
            }
            denseScore = Math.max(0, denseScore); // Normalize negative to 0 for hybrid ranking

            // Sparse BM25 Score
            const rawBm25 = bm25Map.get(item.id) || 0;
            const sparseScore = rawBm25 > 0 ? Math.min(1.0, rawBm25 / 10.0) : 0;

            // Recency & Importance
            const ageHours = Math.max(0, (now - new Date(item.updated_at).getTime()) / (1000 * 60 * 60));
            const recency = 1.0 / (1.0 + ageHours / 168.0);
            const importance = (item.importance || 1.0) / 2.0;

            // Hybrid Weighted Score
            const hybridScore = (denseScore * 0.50) + (sparseScore * 0.35) + (importance * 0.15);

            scored.push({
                id: item.id,
                title: item.title,
                content: item.content,
                category: item.category,
                tags: item.tags,
                source: item.source,
                importance: item.importance,
                score: Number(hybridScore.toFixed(3)),
                denseScore: Number(denseScore.toFixed(3)),
                sparseScore: Number(sparseScore.toFixed(3)),
                updated_at: item.updated_at
            });
        }

        scored.sort((a, b) => b.score - a.score);

        const top = scored.slice(0, limit);
        for (const t of top) {
            this.db.run('UPDATE knowledge_items SET access_count = access_count + 1 WHERE id = ?', t.id);
        }

        return top;
    }

    // Entity Graph Operations
    addEntity(name, type = 'concept', description = '') {
        try {
            this.db.run(`
                INSERT INTO entities (name, type, description)
                VALUES (?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET description = excluded.description, updated_at = CURRENT_TIMESTAMP
            `, name, type, description);
            return true;
        } catch (e) {
            return false;
        }
    }

    addRelation(source, relation, target, weight = 1.0) {
        try {
            this.db.run(`
                INSERT INTO entity_relations (source, relation, target, weight)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(source, relation, target) DO UPDATE SET weight = excluded.weight
            `, source, relation, target, weight);
            return true;
        } catch (e) {
            return false;
        }
    }

    getGraph() {
        const entities = this.db.all('SELECT name, type, description FROM entities');
        const relations = this.db.all('SELECT source, relation, target, weight FROM entity_relations');
        return { entities, relations };
    }
}

let instance = null;

function getSemanticKnowledge(db = getDB()) {
    if (!instance || instance.db !== db) {
        instance = new SemanticKnowledge(db);
    }
    return instance;
}

module.exports = {
    SemanticKnowledge,
    getSemanticKnowledge
};
