// ==============================================================================
// Antigravity Second Brain: Tier 4.5 - Cognitive Memory Consolidation Engine
// Summarizes past conversations, resolves contradictions, and prunes temporary facts
// ==============================================================================

const { getDB } = require('./db');

class MemoryConsolidator {
    constructor(db = getDB()) {
        this.db = db;
    }

    distillSession(conversationId) {
        const path = require('node:path');
        const conv = this.db.get('SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?', conversationId);
        if (!conv) return null;

        const episodes = this.db.all(`
            SELECT role, summary, content, timestamp 
            FROM episodes 
            WHERE conversation_id = ? 
            ORDER BY step_index ASC
        `, conversationId);

        if (!episodes || episodes.length === 0) return null;

        // 1. Extract Primary Goal
        const userEpisodes = episodes.filter(e => e.role === 'user');
        let primaryGoal = '';
        for (const ue of userEpisodes) {
            let text = (ue.content || ue.summary || '').trim();
            // Remove markdown/system tags
            text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const lower = text.toLowerCase();
            // Skip pure greeting if subsequent messages exist
            if (['hi', 'hello', 'chào', 'hey'].includes(lower) && userEpisodes.length > 1) {
                continue;
            }
            primaryGoal = text.length > 140 ? text.slice(0, 137) + '...' : text;
            break;
        }
        if (!primaryGoal && conv.title) {
            primaryGoal = conv.title.slice(0, 140);
        }
        if (!primaryGoal) primaryGoal = 'Thực hiện tác vụ theo yêu cầu của Ngài';

        // 2. Extract Key Decisions & Directives
        const decisionRegex = /(?:quyết định(?:\s+kiến trúc)?|quy tắc|chốt|quy định|không được|từ giờ|bắt buộc|luôn luôn|tiêu chí|nguyên tắc|kiến trúc|rule|decision|yêu cầu|chính sách)[\s:]+([^;\n\r]{10,160})/gi;
        const decisions = new Set();

        for (const ep of episodes) {
            const text = ep.content || '';
            let match;
            while ((match = decisionRegex.exec(text)) !== null) {
                const clean = match[0].replace(/[\r\n]+/g, ' ').trim();
                if (clean.length >= 15 && clean.length <= 150) {
                    decisions.add(clean);
                }
                if (decisions.size >= 4) break;
            }
            if (decisions.size >= 4) break;
        }

        // 3. Extract Files Touched / Artifacts Created
        const fileRegex = /(?:[A-Za-z]:[\\/][\w\s./\\-]+\.(?:js|ts|py|ps1|json|sql|md|html|css|sh|bat)|(?:[\w.-]+[\\/])+[\w.-]+\.(?:js|ts|py|ps1|json|sql|md|html|css|sh|bat)|\b[\w_.-]+\.(?:js|ts|py|ps1|json|sql|md|html|css|sh|bat))\b/gi;
        const files = new Set();
        const ignoredFiles = new Set(['node.exe', 'npm.cmd', 'powershell.exe', 'cmd.exe', 'package.json', 'package-lock.json', 'tsconfig.json']);

        for (const ep of episodes) {
            const text = ep.content || '';
            let match;
            while ((match = fileRegex.exec(text)) !== null) {
                const f = match[0].trim();
                const base = path.basename(f).toLowerCase();
                if (!ignoredFiles.has(base) && !f.includes('node_modules') && !f.includes('.git')) {
                    files.add(path.basename(f));
                }
                if (files.size >= 6) break;
            }
            if (files.size >= 6) break;
        }

        // 4. Extract Learned Fixes / Solutions
        const fixRegex = /(?:đã khắc phục|khắc phục|sửa lỗi|fix|sửa|giải pháp|đã xử lý)[\s:]+([^;\n\r]{10,160})/gi;
        const learnedFixes = new Set();

        for (const ep of episodes) {
            if (ep.role === 'assistant') {
                const summary = ep.summary || '';
                if (summary.startsWith('Called tools:')) continue;
                let match;
                while ((match = fixRegex.exec(ep.content || '')) !== null) {
                    const clean = match[0].replace(/[\r\n]+/g, ' ').trim();
                    if (clean.length >= 15 && clean.length <= 130) {
                        learnedFixes.add(clean);
                    }
                    if (learnedFixes.size >= 3) break;
                }
            }
        }

        const decisionList = Array.from(decisions).slice(0, 3);
        const fileList = Array.from(files).slice(0, 5);
        const fixList = Array.from(learnedFixes).slice(0, 2);

        // 5. Autonomous Promotion to Tier 3 Knowledge & Tier 4 Solutions
        this._autoPromoteInsights(conversationId, primaryGoal, decisionList, fixList);

        // Filter meaningful assistant responses for outcome summary
        const assistantVerbal = episodes
            .filter(e => e.role === 'assistant' && !e.summary.startsWith('Called tools:'))
            .map(e => e.summary.replace(/[\r\n]+/g, ' ').trim())
            .filter(s => s.length > 15)
            .slice(0, 2);

        // Build Executive Distilled Summary
        const parts = [
            `[Mục tiêu: ${primaryGoal}]`
        ];
        if (decisionList.length > 0) {
            parts.push(`[Quyết định: ${decisionList.join('; ')}]`);
        }
        if (fileList.length > 0) {
            parts.push(`[Tệp tin: ${fileList.join(', ')}]`);
        }
        if (fixList.length > 0) {
            parts.push(`[Bài học: ${fixList.join('; ')}]`);
        } else if (assistantVerbal.length > 0) {
            parts.push(`[Kết quả: ${assistantVerbal[0].slice(0, 100)}]`);
        }

        const executiveSummary = parts.join(' | ');

        const takeawaysObj = {
            goal: primaryGoal,
            decisions: decisionList,
            files: fileList,
            solutions: fixList,
            distilled_at: new Date().toISOString()
        };

        this.db.run(`
            UPDATE conversations 
            SET summary = ?, key_takeaways = ?, updated_at = datetime('now')
            WHERE id = ?
        `, executiveSummary, JSON.stringify(takeawaysObj), conversationId);

        return {
            conversationId,
            goal: primaryGoal,
            decisions: decisionList,
            files: fileList,
            solutions: fixList,
            summary: executiveSummary
        };
    }

    distillAll(force = false) {
        const query = force
            ? `SELECT id FROM conversations WHERE message_count >= 2 ORDER BY updated_at DESC`
            : `SELECT id FROM conversations 
               WHERE (summary IS NULL OR length(summary) < 20 OR summary NOT LIKE '[Mục tiêu:%')
                 AND message_count >= 2 
               ORDER BY updated_at DESC`;

        const convs = this.db.all(query);
        let count = 0;
        for (const c of convs) {
            const res = this.distillSession(c.id);
            if (res) count++;
        }
        return count;
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

        // 1. Summarize Past Conversations (Autonomous Executive Session Distillation)
        stats.summarizedConversations = this.distillAll(false);

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

    _autoPromoteInsights(conversationId, primaryGoal, decisionList, fixList) {
        if (!decisionList && !fixList) return;

        // 5.1 Auto-Promote Decisions to knowledge_items
        if (Array.isArray(decisionList)) {
            for (const dec of decisionList) {
                if (!dec || typeof dec !== 'string' || dec.trim().length < 20) continue;
                const cleanDec = dec.replace(/^\[?Quyết định[:\s]*/i, '').trim();
                
                const existing = this.db.get(`
                    SELECT id FROM knowledge_items 
                    WHERE content LIKE ? OR (source = 'auto_distillation' AND title LIKE ?)
                    LIMIT 1
                `, `%${cleanDec.slice(0, 40)}%`, `%${cleanDec.slice(0, 30)}%`);

                if (!existing) {
                    try {
                        const { getSemanticKnowledge } = require('./semantic');
                        const semantic = getSemanticKnowledge(this.db);
                        const title = cleanDec.length > 55 ? cleanDec.slice(0, 52) + '...' : cleanDec;
                        semantic.addItemSync({
                            title: `Quyết định: ${title}`,
                            content: cleanDec,
                            category: 'decision',
                            tags: 'decision,auto_promoted,architecture',
                            source: 'auto_distillation',
                            importance: 1.4
                        });
                    } catch (e) {}
                } else {
                    try {
                        this.db.run(`
                            UPDATE knowledge_items
                            SET importance = MAX(importance, 1.4), access_count = access_count + 1, updated_at = datetime('now')
                            WHERE id = ?
                        `, existing.id);
                    } catch (e) {}
                }
            }
        }

        // 5.2 Auto-Promote Learned Fixes to solutions
        if (Array.isArray(fixList)) {
            for (const fix of fixList) {
                if (!fix || typeof fix !== 'string' || fix.trim().length < 15) continue;
                const cleanFix = fix.replace(/^\[?Bài học[:\s]*/i, '').trim();

                const existing = this.db.get(`
                    SELECT id FROM solutions 
                    WHERE solution_code LIKE ? OR error_pattern LIKE ?
                    LIMIT 1
                `, `%${cleanFix.slice(0, 40)}%`, `%${cleanFix.slice(0, 30)}%`);

                if (!existing) {
                    try {
                        const { getSolutionStore } = require('./solutions');
                        const solutionStore = getSolutionStore(this.db);
                        let errPattern = primaryGoal ? `Lỗi trong tác vụ: ${primaryGoal.slice(0, 60)}` : 'Lỗi hệ thống';
                        let solutionCode = cleanFix;

                        if (cleanFix.includes(':')) {
                            const parts = cleanFix.split(':');
                            errPattern = parts[0].trim();
                            solutionCode = parts.slice(1).join(':').trim();
                        }

                        solutionStore.storeSolution({
                            error_pattern: errPattern,
                            solution_code: solutionCode,
                            command_fix: solutionCode.length <= 100 ? solutionCode : '',
                            root_cause: `Tự động chưng cất từ phiên ${conversationId.slice(0, 8)}`,
                            project_scope: 'global',
                            tags: 'bugfix,auto_promoted'
                        });
                    } catch (e) {}
                } else {
                    try {
                        this.db.run(`
                            UPDATE solutions
                            SET success_count = success_count + 1, confidence = MIN(1.0, confidence + 0.05), updated_at = datetime('now')
                            WHERE id = ?
                        `, existing.id);
                    } catch (e) {}
                }
            }
        }
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
