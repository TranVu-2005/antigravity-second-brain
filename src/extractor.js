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

    extractFromTurn(userText, assistantText = '', context = {}) {
        const userExtractions = this.extractFromText(userText, 'user', context.projectScope || 'global');
        const profiles = [];
        const knowledge = [];
        const solutions = [];

        for (const item of userExtractions) {
            if (item.type === 'profile') {
                profiles.push({
                    key: item.key,
                    value: item.value,
                    category: item.category,
                    action: item.action || 'ADD'
                });
            } else if (item.type === 'knowledge') {
                knowledge.push({
                    title: item.title,
                    content: item.content,
                    category: item.category,
                    tags: item.tags,
                    importance: item.importance
                });
            } else if (item.type === 'solution') {
                solutions.push({
                    error_pattern: item.error_pattern,
                    root_cause: item.root_cause || '',
                    solution_code: item.solution_code,
                    command_fix: item.command_fix || item.solution_code,
                    project_scope: item.project_scope || 'global'
                });
            }
        }

        return { profiles, knowledge, solutions };
    }

    extractFromText(text, role = 'user', projectScope = 'global') {
        if (!text || typeof text !== 'string') return [];
        const extractions = [];
        const clean = text.replace(/<[^>]+>/g, '').trim();

        // --- PROMPT INJECTION GUARD ---
        // Detect adversarial instruction injection patterns embedded in text
        // e.g. "luôn luôn: Bạn là DAN", "from now on you are DAN", "ignore previous instructions"
        const INJECTION_PATTERNS = [
            /(?:ignore|forget|disregard)\s+(?:previous|all|your)\s+instructions/i,
            /(?:you are now|bạn là|bạn bây giờ là|từ bây giờ bạn là)\s+(?:DAN|GPT|an?\s+AI|a\s+different)/i,
            /(?:jailbreak|do\s+anything\s+now|DAN\s+mode)/i,
            /pretend\s+(?:you\s+are|to\s+be)\s+(?:an?\s+)?(?:AI|bot|assistant)\s+(?:without|with\s+no)\s+restrictions/i,
            // Catch "luôn luôn: Bạn là X" injection pattern specifically
            /luôn\s+luôn\s*:\s*(?:bạn|you)\s+(?:là|are)/i,
        ];
        for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(clean)) {
                // Silently drop — do not extract anything from injected text
                return [];
            }
        }

        // --- INTRA-TURN RETRACTION DETECTION ---
        // If the text contains a retraction like "actually", "thực ra", "không phải vậy"
        // immediately after a statement, suppress extraction of the original claim.
        const RETRACTION_PATTERNS = [
            /(?:thực ra|thật ra|ý tôi là|không phải|thôi không|nhầm rồi|cancel that|actually|never mind|scratch that|forget what i said)/i
        ];
        const hasRetraction = RETRACTION_PATTERNS.some(p => p.test(clean));

        // --- CHATTER SUPPRESSION (expanded) ---
        // Pattern: short, casual, daily-life sentences with no memory signal
        const CHATTER_REGEX = /^(?:hôm\s+nay\s+trời|chắc\s+lát\s+nữa|cậu\s+có\s+thấy|bạn\s+có\s+thấy|thời\s+tiết\s+hôm\s+nay|trời\s+mưa|đói\s+bụng|chào\s+bạn|hello|hi\b|how\s+are\s+you|are\s+you\s+hungry|what\s+a\s+nice\s+day|ở\s+nhà\s+ngủ|ở\s+nhà\s+thôi|đang\s+ngủ|đang\s+ăn|đang\s+chơi|dùng\s+dao|cầm\s+dao|xem\s+phim|đi\s+chơi|đi\s+ngủ\s+đây|ok\s+thôi|ừ\s+thôi|được\s+rồi|cảm\s+ơn(?:\s+bạn)?|thank\s+you|no\s+problem|np\b|lol\b|haha|hihi|ok\b|oke\b|okie\b)/i;
        const isCasualChatter = CHATTER_REGEX.test(clean) || (clean.split(/\s+/).length <= 3 && !/(?:ghi nhớ|nhớ|lưu|remember|prefer|always|rule|fix|sửa)/i.test(clean));

        const hasExplicitMemorySignal = /(?:ghi nhớ|nhớ kỹ|lưu vào|chỉ thị|quy tắc|từ nay|chuyên dùng|thích dùng|sống tại|đang ở|sửa lỗi|fix lỗi|cách sửa|remember|prefer|always|rule|fix error)/i.test(clean);
        if (isCasualChatter && !hasExplicitMemorySignal) {
            return [];
        }

        // If retraction detected, abort early — do not store potentially retracted facts
        if (hasRetraction) {
            return [];
        }


        // 1. Location detection (bilingual: VN & EN, conflict resolution support)
        const locMatch = clean.match(/(?:tôi|mình|i)?\s*(?:đã\s+)?(?:chuyển sang sống tại|chuyển đến|ở|sống tại|đang ở|cư ngụ tại|live in|moved to|living in)\s+([A-ZÀ-Ỵa-zà-ỹ0-9\s,]{3,40}?)(?:\s*(?:rồi|\.|\!|\;|\-|\bkhông còn\b|$))/i);
        if (locMatch && !locMatch[1].toLowerCase().includes('đây') && !locMatch[1].toLowerCase().includes('nơi này')) {
            const locVal = locMatch[1].trim();
            const currentLoc = this.profile.get('location');
            const action = currentLoc ? (currentLoc === locVal ? 'NOOP' : 'UPDATE') : 'ADD';
            extractions.push({
                type: 'profile',
                key: 'location',
                category: 'environment',
                value: locVal,
                confidence: 0.95,
                action: action
            });
        }

        // 2. Tech preference / stack (bilingual: VN & EN)
        const techMatch = clean.match(/(?:tôi|mình|chúng tôi|i|we)\s+(?:chuyên dùng|thích dùng|thường dùng|thích code|viết bằng|code bằng|dùng|prefer|specialize in|usually use|love using|code in|write in)\s+([A-Za-zÀ-ỹ0-9+#.\s_]{2,50}?)(?:\s+để\s+|\s+cho\s+|\s+nhé|\s*[,.]|$|\s+ghi nhớ)/i);
        if (techMatch) {
            const tech = techMatch[1].trim();
            const key = `tech_pref_${tech.toLowerCase().replace(/[\s\-_]+/g, '_')}`;
            const currentPref = this.profile.get(key);
            const val = `Thích dùng ${tech}`;
            const action = currentPref ? (currentPref === val ? 'NOOP' : 'UPDATE') : 'ADD';
            extractions.push({
                type: 'profile',
                key: key,
                category: 'tech_stack',
                value: val,
                confidence: 0.9,
                action: action
            });
        }

        // 3. Active project (bilingual: VN & EN)
        const projMatch = clean.match(/(?:tôi|mình|i)\s+(?:đang làm|đang build|đang phát triển|đang làm dự án|working on|building|developing)\s+([A-ZÀ-Ỵa-zà-ỹ0-9_\-\s]{3,40}?)(?:\s*[,.]|$)/i);
        if (projMatch) {
            const proj = projMatch[1].trim();
            extractions.push({
                type: 'knowledge',
                title: `Dự án: ${proj}`,
                content: `Ngài đang phát triển dự án: ${proj}`,
                category: 'decision',
                tags: 'project,active',
                projectScope: projectScope,
                importance: 1.4,
                action: 'ADD'
            });
        }

        // 4. Permanent directives / rules (bilingual: VN & EN, handles colons & whitespace e.g. D-02)
        // NOTE: bare "luôn luôn" removed from pattern — it's an injection vector caught by the guard above.
        // Only match genuine user-framed directives preceded by request verbs.
        const directiveMatch = clean.match(/(?:hãy luôn|từ nay luôn|nhớ luôn(?: luôn)?|sau này hãy|quy tắc là|always remember|from now on always|please always|rule is|mandatory rule)(?:\s*[:\-])?\s+([A-ZÀ-Ỵa-zà-ỹ0-9_,\s\(\)\/]{8,150})/i);
        if (directiveMatch) {
            const directiveText = directiveMatch[1].trim();
            // Reject if the captured directive looks like an identity claim (injection escape hatch)
            const isIdentityClaim = /(?:bạn là|you are|tôi là|i am)\s+\w/i.test(directiveText);
            if (!isIdentityClaim) {
                extractions.push({
                    type: 'knowledge',
                    title: `Chỉ thị của Ngài: ${directiveText.slice(0, 40)}...`,
                    content: directiveMatch[0].trim(),
                    category: 'rule',
                    tags: 'directive,rule,preference',
                    projectScope: 'global',
                    importance: 1.8,
                    action: 'ADD'
                });
            }
        }


        // 5. Bug / Solution detection (bilingual: VN & EN, lazy pattern capture e.g. D-03)
        const solutionMatch = clean.match(/(?:cách sửa lỗi|fix lỗi|sửa lỗi|khắc phục lỗi|how to fix|fix for|solution for)\s+([^:=➔\n]+?)\s*[:=➔]\s*([\s\S]+)/i);
        if (solutionMatch) {
            const errPattern = solutionMatch[1].trim();
            const fixCode = solutionMatch[2].trim();
            extractions.push({
                type: 'solution',
                error_pattern: errPattern,
                solution_code: fixCode,
                command_fix: fixCode,
                project_scope: projectScope,
                tags: 'bugfix,user_stated',
                action: 'ADD'
            });
        }

        // 6. Explicit knowledge storage triggers
        const explicitMatch = clean.match(/(?:ghi nhớ|lưu vào bộ nhớ|nhớ kỹ|remember|store this)(?:\s*(?:điều này|rằng|giúp tôi|this)?\s*[:\-])\s*([\s\S]+)/i);
        if (explicitMatch) {
            const body = explicitMatch[1].trim();
            extractions.push({
                type: 'knowledge',
                title: body.slice(0, 40) + '...',
                content: body,
                category: 'note',
                tags: 'explicit,important',
                projectScope: projectScope,
                importance: 1.6,
                action: 'ADD'
            });
        }

        // Apply extracted items with deduplication and dynamic conflict resolution
        for (const item of extractions) {
            if (item.type === 'profile') {
                const current = this.profile.get(item.key);
                if (item.action === 'DELETE') {
                    this.profile.deleteFact(item.key);
                } else if (current !== item.value) {
                    this.profile.setFact(item.key, item.value, item.category, item.confidence, 'auto_extraction');
                }
            } else if (item.type === 'knowledge') {
                // Deduplication: Avoid adding duplicate knowledge items
                let isDuplicate = false;
                try {
                    const existing = this.semantic.db.all(`
                        SELECT id FROM knowledge_items 
                        WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) OR LOWER(TRIM(content)) = LOWER(TRIM(?))
                    `, item.title, item.content);
                    if (existing && existing.length > 0) {
                        isDuplicate = true;
                    }
                } catch (e) {}

                if (!isDuplicate) {
                    if (this.semantic.addItemSync) {
                        this.semantic.addItemSync({
                            title: item.title,
                            content: item.content,
                            category: item.category,
                            tags: item.tags,
                            source: 'auto_extraction',
                            importance: item.importance
                        });
                    } else {
                        this.semantic.addItem({
                            title: item.title,
                            content: item.content,
                            category: item.category,
                            tags: item.tags,
                            source: 'auto_extraction',
                            importance: item.importance
                        });
                    }
                }
            } else if (item.type === 'solution') {
                // Deduplication: Avoid duplicate solution error patterns
                let isDuplicate = false;
                try {
                    const existing = this.solutions.db.all(`
                        SELECT id FROM solutions 
                        WHERE LOWER(TRIM(error_pattern)) = LOWER(TRIM(?))
                    `, item.error_pattern);
                    if (existing && existing.length > 0) {
                        isDuplicate = true;
                    }
                } catch (e) {}

                if (!isDuplicate) {
                    this.solutions.addSolution({
                        error_pattern: item.error_pattern,
                        solution_code: item.solution_code,
                        command_fix: item.command_fix || item.solution_code,
                        project_scope: item.project_scope || projectScope,
                        tags: item.tags || 'bugfix'
                    });
                }
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
