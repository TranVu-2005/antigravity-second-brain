// ==============================================================================
// Antigravity Second Brain: Multi-Signal Context Compiler & Compressor
// Attention-Weighted Dynamic Packing with Token Budgeting & Project Scoping
// ==============================================================================

const path = require('node:path');
const { getProfileManager } = require('./profile');
const { getSemanticKnowledge } = require('./semantic');
const { getEpisodicMemory } = require('./episodic');
const { getSolutionStore } = require('./solutions');

const DEFAULT_MAX_TOKENS = 800; // ~3200 characters max
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

    async compileContext(query = '', conversationId = null, options = {}) {
        const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
        const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
        const workspacePaths = options.workspacePaths || [];
        const projectScope = this.inferProjectScope(workspacePaths);

        const sections = [];
        let currentChars = 0;

        // ---------------------------------------------------------------------
        // Priority 1: Core Profile of Ngài (Mandatory, High-Density)
        // ---------------------------------------------------------------------
        const profileSummary = this.profile.getProfileSummary();
        sections.push(profileSummary);
        currentChars += profileSummary.length;

        if (query && query.trim()) {
            // -----------------------------------------------------------------
            // Priority 2: Procedural Solutions & Learned Fixes (Proactive Reinforcement)
            // -----------------------------------------------------------------
            const isRelevantToOperations = /(?:lỗi|error|fail|bug|exception|cannot|không thể|fix|sửa|lệnh|command|npm|git|node|powershell|sql|run|script|build|test)/i.test(query);
            if (isRelevantToOperations) {
                const solutions = this.solutions.searchSolutions(query, { project_scope: projectScope, limit: 3 });
                if (solutions && solutions.length > 0) {
                    const solLines = ['[BỘ NHỚ KINH NGHIỆM ĐÃ HỌC (PROCEDURAL FIXES & LESSONS)]'];
                    for (const sol of solutions) {
                        const line = `• Lỗi từng gặp: "${sol.error_pattern}"\n  ➔ LỆNH CHUẨN XÁC: ${sol.command_fix || sol.solution_code} (Độ tin cậy: ${Math.round(sol.confidence * 100)}%, Thành công: ${sol.success_count} lần)`;
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
        // Priority 3: Semantic Knowledge & Technical Decisions (Hybrid Search)
        // ---------------------------------------------------------------------
        const knowledgeResults = await this.semantic.searchKnowledge(query || '', { limit: 4 });
        if (knowledgeResults && knowledgeResults.length > 0) {
            const kLines = [query ? '[TRI THỨC & QUY TẮC PHÙ HỢP]' : '[TRI THỨC & QUY TẮC NỔI BẬT (PINNED/ACTIVE)]'];
            for (const k of knowledgeResults) {
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

        if (query && query.trim()) {
            // -----------------------------------------------------------------
            // Priority 4: Episodic History across Past Conversations
            // -----------------------------------------------------------------
            const episodicResults = this.episodic.searchEpisodes(query, 3);
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
