// ==============================================================================
// Antigravity Second Brain: Multi-Signal Context Compiler & Compressor
// Attention-Weighted Dynamic Packing with Token Budgeting & Project Scoping
// ==============================================================================

const path = require('node:path');
const { getProfileManager } = require('./profile');
const { getSemanticKnowledge } = require('./semantic');
const { getEpisodicMemory } = require('./episodic');
const { getSolutionStore } = require('./solutions');

const DEFAULT_MAX_TOKENS = 1200; // ~4200 characters max
const CHARS_PER_TOKEN = 3.5;

class ContextRetriever {
    constructor() {
        this.profile = getProfileManager();
        this.semantic = getSemanticKnowledge();
        this.episodic = getEpisodicMemory();
        this.solutions = getSolutionStore();
    }

    inferProjectScope(workspacePaths) {
        if (!workspacePaths || !Array.isArray(workspacePaths) || workspacePaths.length === 0) {
            return 'global';
        }
        const primary = workspacePaths[0];
        if (!primary || typeof primary !== 'string') return 'global';
        return path.basename(primary);
    }

    isContinuationPrompt(text) {
        if (!text || typeof text !== 'string') return false;
        const clean = text.trim().toLowerCase();
        return /^(?:continue|tiếp tục|tiep tuc|làm tiếp|lam tiep|tiến hành|tien hanh|làm đi|lam di|chạy tiếp|chay tiep|sao rồi|sao roi|sao r|ok|oke|oki|được rồi|duoc roi)\b/i.test(clean) && clean.length < 50;
    }

    resolveContinuationQuery(conversationId, fallbackQuery = '') {
        if (!conversationId) return fallbackQuery;
        try {
            // 1. Check session_state active goal
            const state = this.profile.getSessionState(conversationId);
            if (state && state.active_goal && state.active_goal.length > 5) {
                return state.active_goal;
            }

            // 2. Check last substantive user prompt in episodes for this conversation
            const row = this.profile.db.get(`
                SELECT content FROM episodes 
                WHERE conversation_id = ? AND role = 'user' 
                ORDER BY step_index DESC LIMIT 1 OFFSET 1
            `, conversationId);
            if (row && row.content && !this.isContinuationPrompt(row.content)) {
                return row.content;
            }

            // 3. Fallback: conversation title
            const conv = this.profile.db.get('SELECT title FROM conversations WHERE id = ?', conversationId);
            if (conv && conv.title && conv.title.length > 5 && !conv.title.startsWith('Conversation ')) {
                return conv.title;
            }

            // 4. Cross-Session Fallback: check latest session in Tier 1 Working Memory
            const latestState = this.profile.getLatestSessionState();
            if (latestState && latestState.active_goal && latestState.active_goal.length > 5) {
                return latestState.active_goal;
            }
        } catch (e) {}
        return fallbackQuery;
    }

    async compileContext(query = '', conversationId = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const maxTokens = opts.maxTokens || DEFAULT_MAX_TOKENS;
        const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
        const workspacePaths = opts.workspacePaths || [];
        const projectScope = this.inferProjectScope(workspacePaths);

        let safeQuery = '';
        if (query !== null && query !== undefined) {
            safeQuery = typeof query === 'string' ? query.trim() : String(query).trim();
        }

        // --- Continuation & Anaphoric Resolution ---
        let effectiveQuery = safeQuery;
        const isContinuation = this.isContinuationPrompt(safeQuery);
        if (isContinuation && conversationId) {
            const resolved = this.resolveContinuationQuery(conversationId, safeQuery);
            if (resolved && resolved !== safeQuery) {
                effectiveQuery = resolved;
            }
        }

        // Update Tier 1 Working Memory (session_state) if substantive goal
        if (conversationId && safeQuery && !isContinuation) {
            try {
                this.profile.updateSessionState(conversationId, {
                    activeGoal: safeQuery.slice(0, 200),
                    workspacePaths
                });
            } catch (e) {}
        }

        const sections = [];
        let currentChars = 0;

        // ---------------------------------------------------------------------
        // Priority 1: Core Profile of Ngài (Mandatory, High-Density)
        // ---------------------------------------------------------------------
        const profileSummary = this.profile.getProfileSummary();
        sections.push(profileSummary);
        currentChars += profileSummary.length;

        // ---------------------------------------------------------------------
        // Priority 1.5: Smart Directive Banner for System Shortcuts (Ponytail)
        // ---------------------------------------------------------------------
        const lowerEff = effectiveQuery.toLowerCase();
        const directives = [];
        if (/(?:temp|nhiệt độ|nhiet do|nhiệt|cảm biến|soc|gpu|cpu|quạt|quat)/i.test(lowerEff)) {
            directives.push("• Tra cứu nhiệt độ phần cứng ➔ Thực thi ngay: `temp` qua terminal (`run_command`).");
        }
        if (/(?:screenoff|tắt màn|tat man|ngủ đông|ngu dong|offscreen)/i.test(lowerEff)) {
            directives.push("• Tắt màn hình Eco ➔ Thực thi ngay: `screenoff` qua terminal (`run_command`).");
        }
        if (/(?:tải|tai|download|tiến độ|tien do|fdm|horizon|forza|fh\d*|diablo|d2r|part\d*|riot|lol|lmht|valorant|tft|game)/i.test(lowerEff)) {
            let targetGame = '';
            if (lowerEff.includes('forza') || lowerEff.includes('horizon') || lowerEff.includes('fh6') || lowerEff.includes('fh5') || lowerEff.includes('forza6')) targetGame = ' forza';
            else if (lowerEff.includes('diablo') || lowerEff.includes('d2r')) targetGame = ' diablo';
            else if (lowerEff.includes('riot')) targetGame = ' riot';
            else if (lowerEff.includes('lol') || lowerEff.includes('lmht')) targetGame = ' lol';
            else if (lowerEff.includes('valorant')) targetGame = ' valorant';
            directives.push(`• Kiểm tra tiến độ tải file & game ➔ Thực thi ngay: \`fdm${targetGame}\` qua terminal (trả kết quả trong <50ms). Tuyệt đối tuân thủ Fast-Path Non-Blocking SLA, không chặn luồng debug code.`);
        }
        if (directives.length > 0) {
            const banner = `[CHỈ THỊ THỰC THI PHÍM TẮT ĐƯỢC PHÁT HIỆN]\n${directives.join('\n')}`;
            sections.push(banner);
            currentChars += banner.length;
        }

        if (effectiveQuery) {
            // -----------------------------------------------------------------
            // Priority 2: Procedural Solutions & Learned Fixes (Proactive Reinforcement)
            // -----------------------------------------------------------------
            const isRelevantToOperations = /(?:lỗi|error|fail|bug|exception|cannot|không thể|fix|sửa|lệnh|command|npm|git|node|powershell|sql|run|script|build|test|tải|download|cài|install|progress|tiến độ|check|status|trạng thái|fdm|diablo|horizon|legion|temp|gpu|cpu)/i.test(effectiveQuery);
            if (isRelevantToOperations) {
                const solutions = this.solutions.searchSolutions(effectiveQuery, { project_scope: projectScope, limit: 3 });
                if (solutions && solutions.length > 0) {
                    const solLines = ['[BỘ NHỚ QUY TRÌNH & GIẢI PHÁP ĐÃ HỌC (PROCEDURAL SOLUTIONS)]'];
                    for (const sol of solutions) {
                        const isProcedure = sol.error_pattern.startsWith('[') || (sol.tags && (sol.tags.includes('procedure') || sol.tags.includes('recipe')));
                        const label = isProcedure ? `• Quy trình: "${sol.error_pattern}"` : `• Lỗi từng gặp: "${sol.error_pattern}"`;
                        const line = `${label}\n  ➔ GIẢI PHÁP / LỆNH CHUẨN: ${sol.command_fix || sol.solution_code} (Độ tin cậy: ${Math.round(sol.confidence * 100)}%)`;
                        if (currentChars + line.length < maxChars) {
                            solLines.push(line);
                            currentChars += line.length;
                        }
                    }
                    if (solLines.length > 1) {
                        sections.push(solLines.join('\n'));
                    }
                }
            }
        }

        // ---------------------------------------------------------------------
        // Priority 2.5: Entity Knowledge Graph Traversal (1-Hop & 2-Hop Relations)
        // ---------------------------------------------------------------------
        if (safeQuery && this.semantic.getRelationsForEntity) {
            try {
                const allEntities = this.semantic.db.all('SELECT name FROM entities');
                const matchedEntities = allEntities.filter(e => 
                    safeQuery.toLowerCase().includes(e.name.toLowerCase())
                );
                if (matchedEntities.length === 0 && /(?:ngài|sir|chủ nhân|bạn)/i.test(safeQuery)) {
                    matchedEntities.push({ name: 'Ngài' });
                }

                if (matchedEntities.length > 0) {
                    const graphLines = ['[QUAN HỆ THỰC THỂ (KNOWLEDGE GRAPH)]'];
                    const seenRel = new Set();
                    for (const ent of matchedEntities) {
                        const rels = this.semantic.getRelationsForEntity(ent.name, 2);
                        for (const r of rels) {
                            const src = r.source_entity || r.source;
                            const tgt = r.target_entity || r.target;
                            const key = `${src}->${r.relation}->${tgt}`;
                            if (!seenRel.has(key)) {
                                seenRel.add(key);
                                const conf = Math.round((r.confidence || r.weight || 1.0) * 100);
                                const line = `• ${src} -[${r.relation}]-> ${tgt} (Độ tin cậy: ${conf}%)`;
                                if (currentChars + line.length < maxChars - 100) {
                                    graphLines.push(line);
                                    currentChars += line.length;
                                }
                            }
                        }
                    }
                    if (graphLines.length > 1) {
                        sections.push(graphLines.join('\n'));
                    }
                }
            } catch (e) {}
        }

        // ---------------------------------------------------------------------
        // Priority 3: Semantic Knowledge & Technical Decisions (Hybrid Search)
        // ---------------------------------------------------------------------
        const isCasualQuery = safeQuery ? /^(?:chào|hi|hello|hey|alo|ê|ơi|bye|tạm biệt|cảm ơn|thanks|thank you|ok|oke|okie|ừ|được rồi)\b/i.test(safeQuery.trim()) : false;

        const knowledgeResults = await this.semantic.searchKnowledge(safeQuery || '', { limit: 4 });
        if (knowledgeResults && knowledgeResults.length > 0) {
            // Dynamic Relevance Cutoff: Only inject if genuinely relevant
            const filteredKnowledge = safeQuery 
                ? (isCasualQuery ? [] : knowledgeResults.filter(k => (k.denseScore >= 0.35 || k.sparseScore >= 0.25)))
                : knowledgeResults;

            if (filteredKnowledge.length > 0) {
                const kLines = [safeQuery ? '[TRI THỨC & QUY TẮC PHÙ HỢP]' : '[TRI THỨC & QUY TẮC NỔI BẬT (PINNED/ACTIVE)]'];
                for (const k of filteredKnowledge) {
                    const scoreText = k.score !== undefined ? ` (Score: ${k.score})` : '';
                    const line = `• [${k.category.toUpperCase()}] ${k.title}: ${k.content}${scoreText}`;
                    if (currentChars + line.length < maxChars - 200) {
                        kLines.push(line);
                        currentChars += line.length;
                    }
                }
                if (kLines.length > 1) {
                    sections.push(kLines.join('\n'));
                }
            }
        }

        if (safeQuery && !isCasualQuery) {
            // -----------------------------------------------------------------
            // Priority 4: Episodic History across Past Conversations
            // -----------------------------------------------------------------
            const episodicResults = this.episodic.searchEpisodes(safeQuery, 3);
            if (episodicResults && episodicResults.length > 0) {
                const eLines = ['[KÝ ỨC HỘI THOẠI QUÁ KHỨ LIÊN QUAN]'];
                for (const ep of episodicResults) {
                    const timeStr = ep.timestamp.split('T')[0];
                    const line = `• [${timeStr} | ${ep.conv_title || 'Phiên trước'}] ${ep.role.toUpperCase()}: ${ep.summary.slice(0, 140)}`;
                    if (currentChars + line.length < maxChars) {
                        eLines.push(line);
                        currentChars += line.length;
                    }
                }
                if (eLines.length > 1) {
                    sections.push(eLines.join('\n'));
                }
            }
        }

        // Add Active Project Scope header if scoped
        if (projectScope && projectScope !== 'global') {
            sections.unshift(`[DỰ ÁN HIỆN TẠI: ${projectScope}]`);
        }

        return sections.join('\n\n');
    }
}

let instance = null;

function getContextRetriever() {
    if (!instance) {
        instance = new ContextRetriever();
    }
    return instance;
}

module.exports = {
    ContextRetriever,
    getContextRetriever
};
