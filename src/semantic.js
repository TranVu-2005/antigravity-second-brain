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
        const count = this.db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
        if (count === 0) {
            // Seed foundational knowledge
            this.addItemSync({
                title: 'Antigravity Architecture & Customizations',
                content: 'Antigravity hỗ trợ Skills, Rules (GEMINI.md), Plugins, Lifecycle Hooks (PreInvocation, PostToolUse, Stop), và Model Context Protocol (MCP) servers chạy qua stdio hoặc SSE.',
                category: 'system',
                tags: 'antigravity,architecture,hooks,mcp',
                source: 'system',
                importance: 1.5
            });

            this.addItemSync({
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
    }

    async _backfillEmbeddings(embedFn = computeEmbedding) {
        try {
            const expectedByteLength = VECTOR_DIM * 4; // 384 * 4 = 1536 bytes
            const rows = this.db.all(`
                SELECT id, title, content, tags, embedding, embedding_status 
                FROM knowledge_items 
                WHERE embedding IS NULL OR embedding_status = 'fallback' OR length(embedding) != ?
            `, expectedByteLength);
            for (const r of rows) {
                const text = `${r.title} ${r.content} ${r.tags || ''}`;
                const vec = await embedFn(text);
                this.db.run(
                    'UPDATE knowledge_items SET embedding = ?, embedding_status = ? WHERE id = ?',
                    vectorToBuffer(vec),
                    'neural',
                    r.id
                );
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
            this.db.run('UPDATE knowledge_items SET embedding = ?, embedding_status = ? WHERE id = ?', vectorToBuffer(vec), 'neural', r.id);
            count++;
        }
        return count;
    }

    async addItem({ title, content, category = 'fact', tags = '', source = 'user', importance = 1.0, trust_level = 'medium', confidence = 0.8, verification_status = 'candidate', last_verified_at = null, project_scope = 'global' }) {
        const now = new Date().toISOString();
        const textToEmbed = `${title} ${content} ${tags}`;
        const vec = await computeEmbedding(textToEmbed);
        const buf = vectorToBuffer(vec);
        const embStatus = 'neural';

        const info = this.db.run(`
            INSERT INTO knowledge_items (title, content, category, tags, source, importance, trust_level, confidence, verification_status, last_verified_at, embedding, embedding_status, project_scope, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, title, content, category, tags, source, importance, trust_level, confidence, verification_status, last_verified_at, buf, embStatus, project_scope, now, now);
        
        const newId = info.lastInsertRowid;
        this.recordMemoryEvent({
            memoryType: 'knowledge',
            itemId: newId,
            eventType: 'CREATED',
            toStatus: verification_status,
            confidence: confidence,
            details: { title, category, project_scope }
        });
        this.recordProvenance({
            memoryType: 'knowledge',
            itemId: newId,
            sourceType: source,
            author: source === 'user' ? 'user' : 'agent'
        });

        return newId;
    }

    addItemSync({ title, content, category = 'fact', tags = '', source = 'user', importance = 1.0, trust_level = 'medium', confidence = 0.8, verification_status = 'candidate', last_verified_at = null, project_scope = 'global' }) {
        const now = new Date().toISOString();
        const textToEmbed = `${title} ${content} ${tags}`;
        const vec = computeEmbeddingSync(textToEmbed);
        const buf = vectorToBuffer(vec);
        const embStatus = 'fallback';

        const info = this.db.run(`
            INSERT INTO knowledge_items (title, content, category, tags, source, importance, trust_level, confidence, verification_status, last_verified_at, embedding, embedding_status, project_scope, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, title, content, category, tags, source, importance, trust_level, confidence, verification_status, last_verified_at, buf, embStatus, project_scope, now, now);

        const newId = info.lastInsertRowid;
        this.recordMemoryEvent({
            memoryType: 'knowledge',
            itemId: newId,
            eventType: 'CREATED',
            toStatus: verification_status,
            confidence: confidence,
            details: { title, category, project_scope }
        });
        this.recordProvenance({
            memoryType: 'knowledge',
            itemId: newId,
            sourceType: source,
            author: source === 'user' ? 'user' : 'agent'
        });

        return newId;
    }

    async updateItem(id, fields = {}) {
        const allowed = ['title', 'content', 'category', 'tags', 'importance', 'trust_level', 'confidence', 'verification_status', 'last_verified_at'];
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

        this.recordMemoryEvent({
            memoryType: 'knowledge',
            itemId: id,
            eventType: 'UPDATED',
            fromStatus: current ? current.verification_status : null,
            toStatus: fields.verification_status || (current ? current.verification_status : null),
            confidence: fields.confidence !== undefined ? fields.confidence : (current ? current.confidence : null),
            details: fields
        });

        return true;
    }

    deleteItem(idOrTitle) {
        let targetId = null;
        if (typeof idOrTitle === 'number' || /^\d+$/.test(idOrTitle)) {
            targetId = Number(idOrTitle);
            this.db.run('DELETE FROM knowledge_items WHERE id = ?', targetId);
        } else {
            const row = this.db.get('SELECT id FROM knowledge_items WHERE title = ? OR title LIKE ? LIMIT 1', idOrTitle, `%${idOrTitle}%`);
            if (row) targetId = row.id;
            this.db.run('DELETE FROM knowledge_items WHERE title = ? OR title LIKE ?', idOrTitle, `%${idOrTitle}%`);
        }
        if (targetId) {
            this.recordMemoryEvent({
                memoryType: 'knowledge',
                itemId: targetId,
                eventType: 'PURGED',
                toStatus: 'purged',
                details: { action: 'physical_erasure' }
            });
        }
        try {
            this.db.exec("INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild');");
        } catch (e) {}
        return true;
    }

    forgetItem(idOrTitle, { hardDelete = false } = {}) {
        let item = null;
        if (typeof idOrTitle === 'number' || /^\d+$/.test(idOrTitle)) {
            item = this.getItem(Number(idOrTitle));
        } else {
            item = this.db.get('SELECT * FROM knowledge_items WHERE title = ? OR title LIKE ? LIMIT 1', idOrTitle, `%${idOrTitle}%`);
        }
        if (!item) return false;

        if (hardDelete) {
            return this.deleteItem(item.id);
        }

        // Logical Forget: Mark as tombstone (excluded from all search & retrieval)
        this.db.run(`
            UPDATE knowledge_items 
            SET verification_status = 'tombstone', updated_at = datetime('now')
            WHERE id = ?
        `, item.id);

        this.recordMemoryEvent({
            memoryType: 'knowledge',
            itemId: item.id,
            eventType: 'TOMBSTONED',
            fromStatus: item.verification_status,
            toStatus: 'tombstone',
            details: { title: item.title, action: 'logical_forget' }
        });
        return true;
    }

    recordMemoryEvent({ memoryType = 'knowledge', itemId, eventType, fromStatus = null, toStatus = null, confidence = null, details = null }) {
        try {
            this.db.run(`
                INSERT INTO memory_events (memory_type, item_id, event_type, from_status, to_status, confidence, details, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, memoryType, itemId, eventType, fromStatus, toStatus, confidence, typeof details === 'object' ? JSON.stringify(details) : (details || '{}'));
            return true;
        } catch (e) {
            return false;
        }
    }

    recordProvenance({ memoryType = 'knowledge', itemId, sourceType = 'user', sourceRef = null, author = 'user' }) {
        try {
            this.db.run(`
                INSERT INTO memory_provenance (memory_type, item_id, source_type, source_ref, author, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, memoryType, itemId, sourceType, sourceRef, author);
            return true;
        } catch (e) {
            return false;
        }
    }

    getMemoryAuditTrail(memoryType = 'knowledge', itemId) {
        try {
            const events = this.db.all(`
                SELECT id, memory_type, item_id, event_type, from_status, to_status, confidence, details, recorded_at
                FROM memory_events
                WHERE memory_type = ? AND item_id = ?
                ORDER BY recorded_at ASC, id ASC
            `, memoryType, itemId);
            const provenance = this.db.all(`
                SELECT id, memory_type, item_id, source_type, source_ref, author, created_at
                FROM memory_provenance
                WHERE memory_type = ? AND item_id = ?
                ORDER BY created_at ASC
            `, memoryType, itemId);
            return { events, provenance };
        } catch (e) {
            return { events: [], provenance: [] };
        }
    }

    getItem(id) {
        return this.db.get('SELECT * FROM knowledge_items WHERE id = ?', id);
    }

    // TRUE HYBRID SEARCH: Reciprocal Rank Fusion (k=60) of Dense Vectors (50%) + Sparse BM25 (35%) + Active Recency (15%) + Graph
    async searchKnowledge(query, optionsOrLimit = 5, maybeCategory = null) {
        let limit = 5;
        let category = null;
        let project_scope = null;
        let expand_graph = true;
        if (typeof optionsOrLimit === 'object' && optionsOrLimit !== null) {
            limit = optionsOrLimit.limit !== undefined ? optionsOrLimit.limit : 5;
            category = optionsOrLimit.category !== undefined ? optionsOrLimit.category : null;
            project_scope = optionsOrLimit.project_scope !== undefined ? optionsOrLimit.project_scope : null;
            if (optionsOrLimit.expand_graph !== undefined) expand_graph = optionsOrLimit.expand_graph;
        } else if (typeof optionsOrLimit === 'number') {
            limit = optionsOrLimit;
            category = maybeCategory;
        } else if (optionsOrLimit === null || optionsOrLimit === undefined) {
            // defaults
        }

        // --- Input validation: coerce non-string query to string, guard null/undefined ---
        if (query === null || query === undefined) {
            query = '';
        } else if (typeof query !== 'string') {
            try {
                query = String(query);
            } catch (e) {
                query = '';
            }
        }

        if (limit === 0) return [];
        limit = (typeof limit === 'number' && limit > 0) ? Math.min(limit, 100) : 5;

        // Scope filter helper
        const buildScopeClause = (tablePrefix = '') => {
            const col = tablePrefix ? `${tablePrefix}.project_scope` : 'project_scope';
            if (project_scope && project_scope !== 'global') {
                return { clause: `(${col} = ? OR ${col} = 'global' OR ${col} IS NULL)`, param: project_scope };
            }
            return { clause: null, param: null };
        };

        const scopeInfo = buildScopeClause();

        if (!query || !query.trim()) {
            const conditions = [];
            const params = [];
            if (category) {
                conditions.push('category = ?');
                params.push(category);
            }
            if (scopeInfo.clause) {
                conditions.push(scopeInfo.clause);
                params.push(scopeInfo.param);
            }
            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            params.push(limit);
            return this.db.all(`
                SELECT id, title, content, category, tags, source, importance, access_count, 
                       trust_level, confidence, verification_status, project_scope, updated_at 
                FROM knowledge_items ${whereClause} 
                ORDER BY importance DESC, updated_at DESC LIMIT ?
            `, ...params);
        }

        const queryVec = await computeEmbedding(query);
        const sanitized = query.replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ').trim();

        // 1. Gather Sparse BM25 Ranks via FTS5
        const bm25Map = new Map();
        const ftsCandidateIds = [];
        if (sanitized) {
            const words = sanitized.split(/\s+/).filter(Boolean);
            const ftsQuery = words.map(w => `"${w}"*`).join(' OR ');
            try {
                const ftsConditions = ['knowledge_fts MATCH ?'];
                const ftsParams = [ftsQuery];
                if (category) {
                    ftsConditions.push('k.category = ?');
                    ftsParams.push(category);
                }
                const kScope = buildScopeClause('k');
                if (kScope.clause) {
                    ftsConditions.push(kScope.clause);
                    ftsParams.push(kScope.param);
                }

                const ftsRows = this.db.all(`
                    SELECT k.id, bm25(knowledge_fts) as raw_rank
                    FROM knowledge_fts
                    JOIN knowledge_items k ON knowledge_fts.rowid = k.id
                    WHERE ${ftsConditions.join(' AND ')}
                    ORDER BY bm25(knowledge_fts) ASC
                    LIMIT 30
                `, ...ftsParams);

                for (const row of ftsRows) {
                    bm25Map.set(row.id, Math.abs(row.raw_rank || 0));
                    ftsCandidateIds.push(row.id);
                }
            } catch (e) {}
        }

        // 1.5 Causal Graph Expansion: Real Graph Path Evidence without arbitrary score floors
        const graphCandidateMap = new Map(); // id -> graphEvidenceScore
        if (expand_graph && sanitized && this.getRelationsForEntity) {
            try {
                const allEntities = this.db.all('SELECT name FROM entities');
                const matchedEntities = allEntities.filter(e => 
                    sanitized.toLowerCase().includes(e.name.toLowerCase())
                );
                for (const ent of matchedEntities) {
                    const rels = this.getRelationsForEntity(ent.name, 2);
                    for (const r of rels) {
                        const tgt = r.target_entity || r.target;
                        const conf = r.confidence !== undefined ? r.confidence : 1.0;
                        const hop = r.depth || r.hop || 1;
                        const pathWeight = conf * Math.pow(0.6, hop);
                        if (tgt && !sanitized.toLowerCase().includes(tgt.toLowerCase())) {
                            // Find knowledge matching target entity
                            const matchingK = this.db.all(`
                                SELECT id FROM knowledge_items 
                                WHERE (title LIKE ? OR tags LIKE ? OR content LIKE ?)
                                ${scopeInfo.clause ? `AND ${scopeInfo.clause}` : ''}
                                LIMIT 5
                            `, `%${tgt}%`, `%${tgt}%`, `%${tgt}%`, ...(scopeInfo.param ? [scopeInfo.param] : []));
                            matchingK.forEach(k => {
                                const currentScore = graphCandidateMap.get(k.id) || 0;
                                graphCandidateMap.set(k.id, Math.max(currentScore, pathWeight));
                            });
                        }
                    }
                }
            } catch (gErr) {}
        }

        // 1.6 Candidate items (Full Dense Scan Architecture < 10,000 vectors)
        let candidateItems;
        const totalCount = this.db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;

        const baseConds = ["verification_status != 'tombstone'"];
        const baseParams = [];
        if (category) {
            baseConds.push('category = ?');
            baseParams.push(category);
        }
        if (scopeInfo.clause) {
            baseConds.push(scopeInfo.clause);
            baseParams.push(scopeInfo.param);
        }
        const baseWhere = baseConds.length > 0 ? `WHERE ${baseConds.join(' AND ')}` : '';

        if (totalCount <= 10000) {
            // Full Dense Scan: Every memory item's embedding is evaluated via cosine similarity
            candidateItems = this.db.all(`
                SELECT id, title, content, category, tags, source, importance, access_count, 
                       trust_level, confidence, verification_status, project_scope, embedding, updated_at 
                FROM knowledge_items ${baseWhere}
            `, ...baseParams);
        } else {
            // Pre-filtered Candidate Union for massive (>10k) datasets
            const recentRows = this.db.all(`
                SELECT id FROM knowledge_items ${baseWhere}
                ORDER BY updated_at DESC LIMIT 100
            `, ...baseParams);

            const graphCandidateIds = Array.from(graphCandidateMap.keys());
            const candidateIdSet = new Set([...ftsCandidateIds, ...graphCandidateIds, ...recentRows.map(r => r.id)]);
            if (candidateIdSet.size === 0) {
                const topImp = this.db.all(`
                    SELECT id FROM knowledge_items ${baseWhere}
                    ORDER BY importance DESC LIMIT 50
                `, ...baseParams);
                topImp.forEach(r => candidateIdSet.add(r.id));
            }
            const candidateIds = Array.from(candidateIdSet);
            const placeholders = candidateIds.map(() => '?').join(',');

            const postConds = [`id IN (${placeholders})`];
            const postParams = [...candidateIds];
            if (category) {
                postConds.push('category = ?');
                postParams.push(category);
            }
            if (scopeInfo.clause) {
                postConds.push(scopeInfo.clause);
                postParams.push(scopeInfo.param);
            }

            candidateItems = this.db.all(`
                SELECT id, title, content, category, tags, source, importance, access_count, 
                       trust_level, confidence, verification_status, project_scope, embedding, updated_at 
                FROM knowledge_items WHERE ${postConds.join(' AND ')}
            `, ...postParams);
        }

        const now = Date.now();
        const expectedByteLength = VECTOR_DIM * 4;

        // Compute individual modality scores (Dense, Sparse BM25, Graph Evidence, Recency)
        const candidates = candidateItems.map(item => {
            let denseScore = 0;
            if (item.embedding && item.embedding.length === expectedByteLength) {
                const itemVec = bufferToVector(item.embedding);
                denseScore = cosineSimilarity(queryVec, itemVec);
            }
            denseScore = Math.max(0, denseScore);

            const rawBm25 = bm25Map.get(item.id) || 0;
            const sparseScore = rawBm25 > 0 ? Math.min(1.0, rawBm25 / 10.0) : 0;

            const graphScore = graphCandidateMap.get(item.id) || 0;

            const ageHours = Math.max(0, (now - new Date(item.updated_at).getTime()) / (1000 * 60 * 60));
            const recencyScore = 1.0 / (1.0 + ageHours / 168.0);

            return {
                id: item.id,
                title: item.title,
                content: item.content,
                category: item.category,
                tags: item.tags,
                source: item.source,
                importance: item.importance,
                trust_level: item.trust_level || 'medium',
                confidence: item.confidence !== undefined ? item.confidence : 0.8,
                verification_status: item.verification_status || 'candidate',
                project_scope: item.project_scope || 'global',
                denseScore: denseScore,
                sparseScore: sparseScore,
                graphScore: graphScore,
                recencyScore: recencyScore,
                updated_at: item.updated_at
            };
        });

        // 2. Reciprocal Rank Fusion & Unified Feature Ranker
        const RRF_K = 60;
        const denseRanked = [...candidates].sort((a, b) => b.denseScore - a.denseScore);
        const sparseRanked = [...candidates].sort((a, b) => b.sparseScore - a.sparseScore);

        const denseRankMap = new Map();
        denseRanked.forEach((c, i) => denseRankMap.set(c.id, i + 1));
        const sparseRankMap = new Map();
        sparseRanked.forEach((c, i) => sparseRankMap.set(c.id, i + 1));

        for (const c of candidates) {
            const rDense = denseRankMap.get(c.id);
            const rSparse = sparseRankMap.get(c.id);

            let denseRrf = c.denseScore > 0 ? (0.50 / (RRF_K + rDense)) : 0;
            if (c.denseScore > 0) {
                denseRrf *= (0.5 + 0.5 * c.denseScore);
            }

            const sparseRrf = c.sparseScore > 0 ? (0.30 / (RRF_K + rSparse)) : 0;
            const graphRrf = c.graphScore > 0 ? (0.10 / RRF_K) * c.graphScore : 0;
            const recencyVal = (0.05 / RRF_K) * c.recencyScore;
            const impVal = (0.05 / RRF_K) * ((c.importance || 1.0) / 2.0);

            const rrfBase = denseRrf + sparseRrf + graphRrf + recencyVal + impVal;

            // Trust-aware score modulation (TRUST-002)
            const isVerified = c.verification_status === 'verified' || c.verification_status === 'stable';
            const trustWeight = c.trust_level === 'high' ? 1.0 : (c.trust_level === 'medium' ? 0.75 : 0.5);
            const verificationBoost = isVerified ? 0.15 : 0.0;

            const rrfTotal = (rrfBase * RRF_K) * (0.8 + 0.2 * trustWeight) + verificationBoost;
            c.score = Number(rrfTotal.toFixed(4));
        }

        candidates.sort((a, b) => b.score - a.score);

        const top = candidates.slice(0, limit);
        for (const t of top) {
            this.db.run('UPDATE knowledge_items SET access_count = access_count + 1 WHERE id = ?', t.id);
        }

        return top;
    }

    // Entity Graph Operations (Bi-Temporal SOTA Graph Engine)
    addEntity(name, type = 'concept', description = '') {
        try {
            this.db.run(`
                INSERT INTO entities (name, type, description)
                VALUES (?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET 
                    type = CASE WHEN excluded.type != 'concept' THEN excluded.type ELSE entities.type END,
                    description = CASE WHEN excluded.description != '' THEN excluded.description ELSE entities.description END,
                    updated_at = CURRENT_TIMESTAMP
            `, name, type, description);
            return true;
        } catch (e) {
            return false;
        }
    }

    addRelation(sourceEntity, relation, targetEntity, options = {}) {
        const confidence = (options && typeof options.confidence === 'number') 
            ? options.confidence 
            : (typeof options === 'number' ? options : 1.0);
        const metadata = (options && options.metadata) ? JSON.stringify(options.metadata) : '{}';
        const validFrom = (options && options.validFrom) || new Date().toISOString();
        const validUntil = (options && options.validUntil) || null;

        // Auto-register entities if they do not exist
        this.addEntity(sourceEntity);
        this.addEntity(targetEntity);

        try {
            // Conflict Superseding: If relation is singular (e.g. prefers, located_in, works_on),
            // supersede previous active relations with different target
            const isSingular = /^(?:prefers|located_in|lives_in|works_as|replaces)$/i.test(relation);
            if (isSingular) {
                this.db.run(`
                    UPDATE entity_relations 
                    SET valid_until = datetime('now'), updated_at = datetime('now')
                    WHERE source_entity = ? COLLATE NOCASE 
                      AND relation = ? COLLATE NOCASE 
                      AND target_entity != ? COLLATE NOCASE
                      AND (valid_until IS NULL OR valid_until > datetime('now'))
                `, sourceEntity, relation, targetEntity);
            }

            // Check if there is an existing active relation for this exact triple
            const existingActive = this.db.get(`
                SELECT id FROM entity_relations 
                WHERE source_entity = ? COLLATE NOCASE 
                  AND relation = ? COLLATE NOCASE 
                  AND target_entity = ? COLLATE NOCASE 
                  AND (valid_until IS NULL OR valid_until > datetime('now'))
            `, sourceEntity, relation, targetEntity);

            if (existingActive) {
                // Update in-place only if currently active
                this.db.run(`
                    UPDATE entity_relations 
                    SET confidence = ?, valid_until = ?, metadata = ?, updated_at = datetime('now')
                    WHERE id = ?
                `, confidence, validUntil, metadata, existingActive.id);
            } else {
                // Insert a brand new history event row
                this.db.run(`
                    INSERT INTO entity_relations (source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, sourceEntity, relation, targetEntity, confidence, validFrom, validUntil, metadata);
            }

            // Append-only True Bi-Temporal Audit Event
            this.db.run(`
                INSERT INTO entity_relation_events (event_type, source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata, transaction_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, existingActive ? 'UPDATE' : 'INSERT', sourceEntity, relation, targetEntity, confidence, validFrom, validUntil, metadata);

            return true;
        } catch (e) {
            return false;
        }
    }

    expireRelation(sourceEntity, relation, targetEntity) {
        try {
            this.db.run(`
                INSERT INTO entity_relation_events (event_type, source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata, transaction_time)
                VALUES ('EXPIRE', ?, ?, ?, 1.0, datetime('now'), datetime('now'), '{}', datetime('now'))
            `, sourceEntity, relation, targetEntity);

            this.db.run(`
                UPDATE entity_relations 
                SET valid_until = datetime('now'), updated_at = datetime('now')
                WHERE source_entity = ? COLLATE NOCASE 
                  AND relation = ? COLLATE NOCASE 
                  AND target_entity = ? COLLATE NOCASE
                  AND (valid_until IS NULL OR valid_until > datetime('now'))
            `, sourceEntity, relation, targetEntity);
            return true;
        } catch (e) {
            return false;
        }
    }

    deleteRelation(sourceEntity, relation, targetEntity) {
        try {
            this.db.run(`
                INSERT INTO entity_relation_events (event_type, source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata, transaction_time)
                VALUES ('DELETE', ?, ?, ?, 1.0, datetime('now'), datetime('now'), '{}', datetime('now'))
            `, sourceEntity, relation, targetEntity);

            this.db.run(`
                DELETE FROM entity_relations 
                WHERE source_entity = ? COLLATE NOCASE 
                  AND relation = ? COLLATE NOCASE 
                  AND target_entity = ? COLLATE NOCASE
            `, sourceEntity, relation, targetEntity);
            return true;
        } catch (e) {
            return false;
        }
    }

    getBitemporalTimeline(sourceEntity, targetEntity = null) {
        if (!sourceEntity) return [];
        let query = `
            SELECT id, event_type, source_entity, relation, target_entity, 
                   confidence, valid_from, valid_until, metadata, transaction_time
            FROM entity_relation_events
            WHERE (source_entity = ? COLLATE NOCASE OR target_entity = ? COLLATE NOCASE)
        `;
        const params = [sourceEntity, sourceEntity];
        if (targetEntity) {
            query += ` AND (source_entity = ? COLLATE NOCASE OR target_entity = ? COLLATE NOCASE)`;
            params.push(targetEntity, targetEntity);
        }
        query += ` ORDER BY transaction_time ASC, id ASC`;
        return this.db.all(query, ...params);
    }

    getGraph(includeExpired = false) {
        const entities = this.db.all('SELECT name, type, description FROM entities');
        const filter = includeExpired ? '' : "WHERE (valid_until IS NULL OR valid_until > datetime('now'))";
        const relations = this.db.all(`
            SELECT source_entity AS source, relation, target_entity AS target, confidence AS weight, 
                   source_entity, target_entity, confidence, valid_from, valid_until, metadata 
            FROM entity_relations ${filter}
        `);
        return { entities, relations };
    }

    getRelationsForEntity(entityName, maxDepth = 2, includeExpired = false) {
        if (!entityName || typeof entityName !== 'string') return [];
        const incFlag = includeExpired ? 1 : 0;
        try {
            return this.db.all(`
                WITH RECURSIVE graph_hops AS (
                    SELECT 
                        source_entity,
                        relation,
                        target_entity,
                        confidence,
                        valid_from,
                        valid_until,
                        1 AS depth,
                        source_entity || ' -[' || relation || ']-> ' || target_entity AS path
                    FROM entity_relations
                    WHERE (source_entity = ? COLLATE NOCASE OR target_entity = ? COLLATE NOCASE)
                      AND (? = 1 OR (valid_until IS NULL OR valid_until > datetime('now')))

                    UNION ALL

                    SELECT 
                        r.source_entity,
                        r.relation,
                        r.target_entity,
                        r.confidence * gh.confidence AS confidence,
                        r.valid_from,
                        r.valid_until,
                        gh.depth + 1,
                        gh.path || ' -> ' || r.target_entity AS path
                    FROM entity_relations r
                    JOIN graph_hops gh ON (
                        (r.source_entity = gh.target_entity OR r.target_entity = gh.source_entity)
                        AND r.source_entity != gh.source_entity
                    )
                    WHERE gh.depth < ?
                      AND (? = 1 OR (r.valid_until IS NULL OR r.valid_until > datetime('now')))
                      AND gh.path NOT LIKE '%' || r.target_entity || '%'
                )
                SELECT DISTINCT source_entity, relation, target_entity, confidence, depth, valid_from, valid_until,
                       source_entity AS source, target_entity AS target, confidence AS weight
                FROM graph_hops 
                ORDER BY depth ASC, confidence DESC 
                LIMIT 15;
            `, entityName, entityName, incFlag, maxDepth, incFlag);
        } catch (e) {
            try {
                return this.db.all(`
                    SELECT source_entity, relation, target_entity, confidence, 1 AS depth, valid_from, valid_until,
                           source_entity AS source, target_entity AS target, confidence AS weight
                    FROM entity_relations
                    WHERE (source_entity = ? COLLATE NOCASE OR target_entity = ? COLLATE NOCASE)
                      AND (? = 1 OR (valid_until IS NULL OR valid_until > datetime('now')))
                    ORDER BY confidence DESC
                    LIMIT 15
                `, entityName, entityName, incFlag);
            } catch (err) {
                return [];
            }
        }
    }

    seedCoreGraph() {
        const coreEntities = [
            { name: 'Ngài', type: 'person', description: 'Master & System Architect' },
            { name: 'Hoàng Mai', type: 'location', description: 'Địa bàn cư ngụ tại Hà Nội' },
            { name: 'Antigravity 2.0', type: 'platform', description: 'Google Advanced Agentic Coding Assistant' },
            { name: 'Second Brain', type: 'system', description: 'Autonomous Multi-Tier Memory Engine' },
            { name: 'Dual-Quota Bridge', type: 'technology', description: 'High-speed Chrome Extension Bridge to Gemini Web' },
            { name: 'Gemini Web', type: 'service', description: 'Google Gemini Web with 0 API tokens' },
            { name: 'Lenovo Legion Toolkit', type: 'tool', description: 'CLI & Quick Action Hardware Automation' },
            { name: 'FastTemp', type: 'tool', description: 'Hardware Sensor Temperature Reader' },
            { name: 'Windows 11', type: 'environment', description: 'Operating System (tranvu-galactic-ion)' },
            { name: 'GitHub Backup', type: 'system', description: 'Remote Version Control & Cloud Sync' }
        ];

        for (const ent of coreEntities) {
            this.addEntity(ent.name, ent.type, ent.description);
        }

        const coreRelations = [
            { source: 'Ngài', relation: 'located_in', target: 'Hoàng Mai' },
            { source: 'Ngài', relation: 'uses', target: 'Antigravity 2.0' },
            { source: 'Ngài', relation: 'owns', target: 'Second Brain' },
            { source: 'Antigravity 2.0', relation: 'runs_on', target: 'Windows 11' },
            { source: 'Antigravity 2.0', relation: 'integrates', target: 'Second Brain' },
            { source: 'Antigravity 2.0', relation: 'bridges_to', target: 'Gemini Web' },
            { source: 'Gemini Web', relation: 'powered_by', target: 'Dual-Quota Bridge' },
            { source: 'Second Brain', relation: 'monitors_via', target: 'FastTemp' },
            { source: 'Second Brain', relation: 'automates_via', target: 'Lenovo Legion Toolkit' },
            { source: 'Second Brain', relation: 'persists_to', target: 'GitHub Backup' }
        ];

        for (const rel of coreRelations) {
            this.addRelation(rel.source, rel.relation, rel.target, { confidence: 1.0 });
        }
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
