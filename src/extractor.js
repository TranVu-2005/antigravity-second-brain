// ==============================================================================
// Antigravity Second Brain: Tier 4 - Autonomous Extraction & Reflection Engine
// Detects high-signal memories, preferences, facts, and bug-fix solutions
// ==============================================================================

const { getProfileManager } = require('./profile');
const { getSemanticKnowledge } = require('./semantic');
const { getSolutionStore } = require('./solutions');

class MemoryExtractor {
    constructor(
        profileManager = getProfileManager(), 
        semantic = getSemanticKnowledge(),
        solutionStore = getSolutionStore()
    ) {
        this.profile = profileManager;
        this.semantic = semantic;
        this.solutions = solutionStore;
    }

    extractFromText(text, role = 'user', projectScope = 'global') {
        if (!text || typeof text !== 'string') return [];
        const extractions = [];
        const clean = text.replace(/<[^>]+>/g, '').trim();

        // 1. Location detection
        const locMatch = clean.match(/(?:tôi|mình)\s+(?:ở|sống tại|đang ở)\s+([A-ZÀ-Ỵa-zà-ỹ0-9\s,]{3,35})/i);
        if (locMatch && !locMatch[1].toLowerCase().includes('đây')) {
            extractions.push({
                type: 'profile',
                key: 'location',
                category: 'environment',
                value: locMatch[1].trim(),
                confidence: 0.95
            });
        }

        // 2. Tech preference / stack
        const techMatch = clean.match(/(?:tôi|mình)\s+(?:thích dùng|thường dùng|chuyên dùng|thích code|viết bằng|code bằng)\s+([A-Za-z0-9+#.\s]{2,40})/i);
        if (techMatch) {
            extractions.push({
                type: 'profile',
                key: `tech_pref_${techMatch[1].trim().toLowerCase().replace(/\s+/g, '_')}`,
                category: 'tech_stack',
                value: `Thích dùng ${techMatch[1].trim()}`,
                confidence: 0.9
            });
        }

        // 3. Active project
        const projMatch = clean.match(/(?:tôi|mình)\s+(?:đang làm|đang build|đang phát triển|đang làm dự án)\s+([A-ZÀ-Ỵa-zà-ỹ0-9_\-\s]{3,40})/i);
        if (projMatch) {
            extractions.push({
                type: 'knowledge',
                title: `Dự án: ${projMatch[1].trim()}`,
                content: `Ngài đang phát triển dự án: ${projMatch[1].trim()}`,
                category: 'decision',
                tags: 'project,active',
                projectScope: projectScope,
                importance: 1.4
            });
        }

        // 4. Permanent directives / rules ("hãy luôn...", "sau này nhớ...", "quy tắc là...")
        const directiveMatch = clean.match(/(?:hãy luôn|từ nay luôn|nhớ luôn|sau này hãy|luôn luôn)\s+([A-ZÀ-Ỵa-zà-ỹ0-9_,\s]{8,120})/i);
        if (directiveMatch) {
            extractions.push({
                type: 'knowledge',
                title: `Chỉ thị của Ngài: ${directiveMatch[1].trim().slice(0, 40)}...`,
                content: directiveMatch[0].trim(),
                category: 'rule',
                tags: 'directive,rule,preference',
                projectScope: 'global',
                importance: 1.8
            });
        }

        // 5. Bug / Solution detection ("fix lỗi X bằng Y", "cách sửa lỗi X: Y")
        const solutionMatch = clean.match(/(?:cách sửa lỗi|fix lỗi|sửa lỗi|khắc phục lỗi)\s+([A-Za-z0-9_.\s\-:]{3,60})\s*[:\-=➔]\s*([\s\S]+)/i);
        if (solutionMatch) {
            extractions.push({
                type: 'solution',
                error_pattern: solutionMatch[1].trim(),
                solution_code: solutionMatch[2].trim(),
                project_scope: projectScope,
                tags: 'bugfix,user_stated'
            });
        }

        // 6. Explicit knowledge storage triggers ("ghi nhớ điều này:", "lưu vào bộ nhớ:")
        const explicitMatch = clean.match(/(?:ghi nhớ|lưu vào bộ nhớ|nhớ kỹ)(?:\s*(?:điều này|rằng|giúp tôi)?\s*[:\-])\s*([\s\S]+)/i);
        if (explicitMatch) {
            const body = explicitMatch[1].trim();
            extractions.push({
                type: 'knowledge',
                title: body.slice(0, 40) + '...',
                content: body,
                category: 'note',
                tags: 'explicit,important',
                projectScope: projectScope,
                importance: 1.6
            });
        }

        // Apply extracted items
        for (const item of extractions) {
            if (item.type === 'profile') {
                const current = this.profile.get(item.key);
                if (current !== item.value) {
                    this.profile.setFact(item.key, item.value, item.category, item.confidence, 'auto_extraction');
                }
            } else if (item.type === 'knowledge') {
                this.semantic.addItem({
                    title: item.title,
                    content: item.content,
                    category: item.category,
                    tags: item.tags,
                    source: 'auto_extraction',
                    importance: item.importance
                });
            } else if (item.type === 'solution') {
                this.solutions.addSolution({
                    error_pattern: item.error_pattern,
                    solution_code: item.solution_code,
                    project_scope: item.project_scope || projectScope,
                    tags: item.tags || 'bugfix'
                });
            }
        }

        return extractions;
    }

    // Inspect tool step errors & auto-mined fixes
    extractFromToolSteps(errorOutput, fixCommand, projectScope = 'global') {
        if (!errorOutput || !fixCommand) return null;
        const errLines = errorOutput.trim().split('\n').filter(Boolean);
        const errorPattern = errLines[0].slice(0, 100);

        return this.solutions.addSolution({
            error_pattern: errorPattern,
            root_cause: errorOutput.slice(0, 300),
            solution_code: `Thực thi lệnh: ${fixCommand}`,
            command_fix: fixCommand,
            project_scope: projectScope,
            tags: 'tool_auto_mined'
        });
    }
}

let instance = null;

function getMemoryExtractor() {
    if (!instance) {
        instance = new MemoryExtractor();
    }
    return instance;
}

module.exports = {
    MemoryExtractor,
    getMemoryExtractor
};
