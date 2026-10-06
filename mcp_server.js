#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: MCP Server (Model Context Protocol - Stdio Transport)
// Production-grade JSON-RPC 2.0 interface exposing memory tools directly to AI Agent
// ==============================================================================

const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const { getDB } = require('./src/db');
const { getProfileManager } = require('./src/profile');
const { getSemanticKnowledge } = require('./src/semantic');
const { getEpisodicMemory } = require('./src/episodic');
const { getSolutionStore } = require('./src/solutions');
const { getGitBackupManager } = require('./src/git_backup');
const { VECTOR_DIM } = require('./src/embedding');
const PKG_VERSION = require('./package.json').version;

const TOOLS = [
    {
        name: 'brain_search',
        description: 'Tìm kiếm đa tầng trong Second Brain: tri thức kỹ thuật, ghi chú, quyết định và cả lịch sử hội thoại trước đây.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Từ khóa hoặc câu hỏi cần tra cứu' },
                scope: { 
                    type: 'string', 
                    enum: ['all', 'knowledge', 'conversations'], 
                    description: 'Phạm vi tìm kiếm (all, knowledge, conversations)',
                    default: 'all'
                },
                limit: { type: 'integer', description: 'Số kết quả tối đa', default: 5 }
            },
            required: ['query']
        }
    },
    {
        name: 'brain_store',
        description: 'Lưu trữ một kiến thức, ghi chú, giải pháp kỹ thuật, hoặc quyết định mới vào Second Brain của Ngài.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Tiêu đề ngắn gọn của mục kiến thức' },
                content: { type: 'string', description: 'Nội dung chi tiết cần ghi nhớ' },
                category: { 
                    type: 'string', 
                    enum: ['fact', 'decision', 'snippet', 'rule', 'note', 'concept'], 
                    description: 'Phân loại kiến thức',
                    default: 'note' 
                },
                tags: { type: 'string', description: 'Các thẻ phân loại cách nhau bằng dấu phẩy' },
                importance: { type: 'number', description: 'Độ quan trọng (0.5 đến 2.0)', default: 1.0 }
            },
            required: ['title', 'content']
        }
    },
    {
        name: 'brain_delete',
        description: 'Xóa một mục kiến thức khỏi Second Brain theo ID.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'integer', description: 'ID của mục kiến thức cần xóa' }
            },
            required: ['id']
        }
    },
    {
        name: 'brain_profile_get',
        description: 'Xem toàn bộ hồ sơ danh tính, sở thích, môi trường và phong cách của Ngài.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'brain_profile_set',
        description: 'Cập nhật hoặc thêm mới thông tin vào hồ sơ cốt lõi của Ngài (biết tôi là ai).',
        inputSchema: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Khóa thông tin (vd: favorite_lang, work_hours, project_focus)' },
                value: { type: 'string', description: 'Giá trị cần thiết lập' },
                category: { 
                    type: 'string', 
                    enum: ['identity', 'preference', 'tech_stack', 'environment', 'style', 'general'], 
                    default: 'preference' 
                }
            },
            required: ['key', 'value']
        }
    },
    {
        name: 'brain_conversation_history',
        description: 'Tra cứu các phiên trò chuyện và nội dung trao đổi chi tiết trong quá khứ.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Từ khóa tìm kiếm trong lịch sử (tùy chọn)' },
                limit: { type: 'integer', description: 'Số phiên tối đa cần xem', default: 5 }
            }
        }
    },
    {
        name: 'brain_solution_search',
        description: 'Tra cứu các lỗi kỹ thuật, mã lỗi, và cách xử lý đã từng được học trong Procedural Memory.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Mô tả lỗi hoặc triệu chứng kỹ thuật' },
                project_scope: { type: 'string', description: 'Phạm vi dự án (tùy chọn)' },
                limit: { type: 'integer', description: 'Số giải pháp tối đa', default: 3 }
            },
            required: ['query']
        }
    },
    {
        name: 'brain_solution_store',
        description: 'Lưu trữ một cặp Lỗi ➔ Giải pháp kỹ thuật vào Procedural Memory để tái sử dụng vĩnh viễn.',
        inputSchema: {
            type: 'object',
            properties: {
                error_pattern: { type: 'string', description: 'Chuỗi lỗi hoặc triệu chứng kỹ thuật' },
                solution_code: { type: 'string', description: 'Giải pháp code hoặc cách sửa' },
                root_cause: { type: 'string', description: 'Nguyên nhân gốc rễ gây ra lỗi' },
                command_fix: { type: 'string', description: 'Lệnh shell để sửa lỗi (nếu có)' },
                project_scope: { type: 'string', description: 'Phạm vi dự án (mặc định global)', default: 'global' },
                tags: { type: 'string', description: 'Thẻ phân loại cách nhau bằng dấu phẩy' }
            },
            required: ['error_pattern', 'solution_code']
        }
    },
    {
        name: 'brain_stats',
        description: 'Xem thống kê tổng quan về trạng thái của Second Brain.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'brain_git_backup',
        description: 'Tự động trích xuất toàn bộ dữ liệu Second Brain ra text diff và commit bản sao lưu lên Git repo.',
        inputSchema: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'Thông điệp commit tùy chỉnh (tùy chọn)' }
            }
        }
    },
    {
        name: 'brain_git_status',
        description: 'Kiểm tra trạng thái Git repository, nhánh, commit mới nhất và cấu hình Remote của Second Brain.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'brain_remember',
        description: 'Chủ động ghi nhớ một thông tin, thói quen, chỉ thị hoặc quan hệ thực thể mới (Letta-style Active Memory).',
        inputSchema: {
            type: 'object',
            properties: {
                text: { type: 'string', description: 'Nội dung sự thật hoặc tri thức cần ghi nhớ' },
                category: { 
                    type: 'string', 
                    enum: ['fact', 'preference', 'rule', 'tech_stack', 'entity_relation'],
                    description: 'Phân loại tri thức (mặc định: preference)',
                    default: 'preference'
                },
                key: { type: 'string', description: 'Khóa định danh (tùy chọn, tự động sinh nếu bỏ trống)' },
                relation: {
                    type: 'object',
                    description: 'Thông tin quan hệ thực thể (nếu category là entity_relation)',
                    properties: {
                        source: { type: 'string', description: 'Thực thể nguồn (vd: Ngài)' },
                        predicate: { type: 'string', description: 'Quan hệ (vd: prefers, uses, located_in)' },
                        target: { type: 'string', description: 'Thực thể đích (vd: Svelte, Hoàng Mai)' }
                    }
                }
            },
            required: ['text']
        }
    },
    {
        name: 'brain_forget',
        description: 'Chủ động loại bỏ, đính chính hoặc hết hiệu lực một thông tin lỗi thời trong Second Brain (Letta-style Active Forgetting).',
        inputSchema: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Khóa profile cần xóa, hoặc tên thực thể/mục kiến thức' },
                target: { type: 'string', description: 'Thực thể đích nếu muốn hủy quan hệ (tùy chọn)' },
                reason: { type: 'string', description: 'Lý do gỡ bỏ hoặc đính chính (tùy chọn)' }
            },
            required: ['key']
        }
    },
    {
        name: 'brain_learn_fix',
        description: 'Chủ động ghi nhớ ngay một kinh nghiệm sửa lỗi dòng lệnh vừa được kiểm chứng thành công vào trí nhớ thủ tục.',
        inputSchema: {
            type: 'object',
            properties: {
                error_pattern: { type: 'string', description: 'Mẫu chuỗi lỗi nhận dạng (signature error)' },
                solution_code: { type: 'string', description: 'Giải pháp sửa lỗi chi tiết' },
                command_fix: { type: 'string', description: 'Lệnh dòng lệnh chính xác sửa được lỗi (tùy chọn)' },
                root_cause: { type: 'string', description: 'Nguyên nhân gốc rễ của lỗi (tùy chọn)' },
                project_scope: { type: 'string', description: 'Phạm vi dự án áp dụng (mặc định: global)', default: 'global' }
            },
            required: ['error_pattern', 'solution_code']
        }
    }
];

class SecondBrainMCPServer {
    constructor() {
        this.profile = getProfileManager();
        this.semantic = getSemanticKnowledge();
        this.episodic = getEpisodicMemory();
        this.solutions = getSolutionStore();
        this.gitBackup = getGitBackupManager();
        this.db = getDB();
    }

    start() {
        // Automatically ensure neural embedding daemon is running
        try {
            const { ensureDaemonRunning } = require('./src/embedding');
            ensureDaemonRunning();
        } catch (e) {}

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });

        rl.on('line', async (line) => {
            if (!line.trim()) return;
            try {
                const request = JSON.parse(line);
                await this.handleRequest(request);
            } catch (err) {
                // Ignore parse errors
            }
        });
    }

    sendResponse(response) {
        process.stdout.write(JSON.stringify(response) + '\n');
    }

    async handleRequest(req) {
        const { id, method, params } = req;

        // MCP Notifications (no id)
        if (id === undefined || id === null) {
            return;
        }

        switch (method) {
            case 'initialize': {
                const clientVersion = params?.protocolVersion || '2024-11-05';
                const supportedVersions = ['2024-11-05', '2025-03-20', '2026-07-28'];
                const negotiatedVersion = supportedVersions.includes(clientVersion) ? clientVersion : '2024-11-05';

                this.sendResponse({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: negotiatedVersion,
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: 'antigravity-second-brain',
                            version: PKG_VERSION
                        }
                    }
                });
                break;
            }

            case 'tools/list':
                this.sendResponse({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: TOOLS
                    }
                });
                break;

            case 'tools/call':
                await this.handleToolCall(id, params);
                break;

            default:
                this.sendResponse({
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method '${method}' not found`
                    }
                });
                break;
        }
    }

    async handleToolCall(id, params) {
        const { name, arguments: args } = params || {};

        try {
            let resultText = '';

            switch (name) {
                case 'brain_search': {
                    const query = args.query || '';
                    const scope = args.scope || 'all';
                    const limit = args.limit || 5;

                    const results = [];

                    if (scope === 'all' || scope === 'knowledge') {
                        const kn = await this.semantic.searchKnowledge(query, { limit });
                        for (const k of kn) {
                            results.push(`[Tri thức #${k.id} | ${k.category.toUpperCase()}] ${k.title}\n${k.content}\nTags: ${k.tags || 'none'} (Score: ${k.score})`);
                        }
                    }

                    if (scope === 'all' || scope === 'conversations') {
                        const ep = this.episodic.searchEpisodes(query, limit);
                        for (const e of ep) {
                            results.push(`[Hội thoại | ${e.timestamp.split('T')[0]}] [${e.conv_title || 'Session'}] ${e.role.toUpperCase()}: ${e.content.slice(0, 300)}`);
                        }
                    }

                    resultText = results.length > 0 
                        ? `Tìm thấy ${results.length} kết quả phù hợp:\n\n` + results.join('\n\n---\n\n')
                        : `Không tìm thấy kết quả nào phù hợp với từ khóa "${query}".`;
                    break;
                }

                case 'brain_store': {
                    const insertId = await this.semantic.addItem({
                        title: args.title,
                        content: args.content,
                        category: args.category || 'note',
                        tags: args.tags || '',
                        source: 'agent_mcp',
                        importance: args.importance || 1.0
                    });
                    resultText = `Đã ghi nhớ thành công vào Second Brain với ID #${insertId} (Tiêu đề: "${args.title}").`;
                    break;
                }

                case 'brain_delete': {
                    const success = this.semantic.deleteItem(args.id);
                    resultText = success ? `Đã xóa thành công mục kiến thức ID #${args.id}.` : `Không thể xóa mục ID #${args.id}.`;
                    break;
                }

                case 'brain_profile_get': {
                    const facts = this.profile.getAll();
                    resultText = `=== HỒ SƠ DANH TÍNH CỦA NGÀI ===\n\n` + 
                        facts.map(f => `• [${f.category}] ${f.key}: ${f.value} (Nguồn: ${f.source})`).join('\n');
                    break;
                }

                case 'brain_profile_set': {
                    this.profile.setFact(args.key, args.value, args.category || 'preference', 1.0, 'user_update');
                    resultText = `Đã cập nhật hồ sơ của Ngài: ${args.key} = "${args.value}".`;
                    break;
                }

                case 'brain_conversation_history': {
                    const query = args.query;
                    const limit = args.limit || 5;
                    if (query) {
                        const ep = this.episodic.searchEpisodes(query, limit);
                        resultText = `Kết quả tra cứu lịch sử hội thoại cho "${query}":\n\n` +
                            ep.map(e => `• [${e.timestamp}] ${e.role}: ${e.summary}`).join('\n');
                    } else {
                        const convs = this.episodic.getConversations(limit);
                        resultText = `Danh sách các phiên làm việc gần nhất:\n\n` +
                            convs.map(c => `• [${c.id.slice(0, 8)}] "${c.title}" (${c.message_count} tin nhắn, cập nhật: ${c.updated_at})`).join('\n');
                    }
                    break;
                }

                case 'brain_solution_search': {
                    const query = args.query || '';
                    const projectScope = args.project_scope || null;
                    const limit = args.limit || 3;
                    const sols = this.solutions.searchSolutions(query, { project_scope: projectScope, limit });

                    resultText = sols.length > 0
                        ? `Tìm thấy ${sols.length} giải pháp kỹ thuật đã học:\n\n` + 
                          sols.map(s => `• Lỗi: "${s.error_pattern}"\n  Nguyên nhân: ${s.root_cause || 'N/A'}\n  Giải pháp: ${s.solution_code}${s.command_fix ? `\n  Lệnh: ${s.command_fix}` : ''}\n  (Độ tin cậy: ${s.confidence * 100}%, Số lần fix: ${s.success_count})`).join('\n\n---\n\n')
                        : `Chưa có giải pháp nào được lưu trong Procedural Memory cho lỗi "${query}".`;
                    break;
                }

                case 'brain_solution_store': {
                    const id = this.solutions.addSolution({
                        error_pattern: args.error_pattern,
                        solution_code: args.solution_code,
                        root_cause: args.root_cause || '',
                        command_fix: args.command_fix || '',
                        project_scope: args.project_scope || 'global',
                        tags: args.tags || 'manual_entry'
                    });
                    resultText = `Đã ghi nhận giải pháp thành công vào Procedural Memory với ID #${id}.`;
                    break;
                }

                case 'brain_stats': {
                    const knCount = this.db.get('SELECT COUNT(*) as cnt FROM knowledge_items').cnt;
                    const epCount = this.db.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
                    const convCount = this.db.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
                    const profCount = this.db.get('SELECT COUNT(*) as cnt FROM user_profile').cnt;
                    const solCount = this.db.get('SELECT COUNT(*) as cnt FROM solutions').cnt;
                    const embRow = this.db.get('SELECT length(embedding) as len FROM knowledge_items WHERE embedding IS NOT NULL LIMIT 1');
                    const actualDim = (embRow && embRow.len) ? (embRow.len / 4) : VECTOR_DIM;
                    const dbPath = path.join(__dirname, 'brain.db');
                    const dbSize = fs.existsSync(dbPath) ? `${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB` : 'N/A';

                    resultText = `=== ANTIGRAVITY SECOND BRAIN STATS (v${PKG_VERSION} Production-Grade) ===\n` +
                        `• Hồ sơ người dùng (User Profile): ${profCount} mục\n` +
                        `• Tri thức dài hạn (Knowledge Items): ${knCount} mục\n` +
                        `• Bộ nhớ quy trình sửa lỗi (Solutions): ${solCount} giải pháp\n` +
                        `• Tổng số sự kiện hội thoại (Episodes): ${epCount} tin nhắn\n` +
                        `• Tổng số phiên hội thoại (Conversations): ${convCount} phiên\n` +
                        `• Không gian vector nhúng: ${actualDim}-dim Dense Vectors (Đo trực tiếp từ CSDL: ${embRow && embRow.len ? embRow.len : 0} bytes/record)\n` +
                        `• Database engine: SQLite WAL mode + FTS5 BM25 (Dung lượng: ${dbSize})\n` +
                        `• Trạng thái: Sẵn sàng phục vụ Ngài!`;
                    break;
                }

                case 'brain_git_backup': {
                    const res = this.gitBackup.commitBackup(args.message || null);
                    if (!res.success) {
                        resultText = `❌ Lỗi thực hiện Git Backup: ${res.error}`;
                    } else if (res.committed) {
                        resultText = `✅ Đã tạo commit Git Backup thành công!\n• Commit: ${res.commit}\n• Thống kê: ${res.stats.profileCount} profile, ${res.stats.knowledgeCount} knowledge, ${res.stats.solutionsCount} solutions, ${res.stats.conversationsCount} convs.`;
                    } else {
                        resultText = `ℹ️ ${res.message}\n• Dữ liệu hiện tại đã đồng bộ và không có thay đổi mới.`;
                    }
                    break;
                }

                case 'brain_git_status': {
                    const st = this.gitBackup.getStatus();
                    if (!st.gitAvailable) {
                        resultText = `❌ Git chưa khả dụng trên máy: ${st.error}`;
                    } else if (!st.initialized) {
                        resultText = `⚠️ Git repository chưa được khởi tạo. Hãy gọi tool brain_git_backup để khởi tạo lần đầu.`;
                    } else {
                        resultText = `=== TRẠNG THÁI GIT SECOND BRAIN ===\n` +
                            `• Phiên bản Git: ${st.version}\n` +
                            `• Nhánh hiện tại: ${st.branch}\n` +
                            `• Commit mới nhất: ${st.lastCommit}\n` +
                            `• Remote URL: ${st.remoteUrl || 'Chưa cấu hình remote (chỉ lưu cục bộ)'}\n` +
                            `• Tệp chưa commit: ${st.uncommittedCount}`;
                    }
                    break;
                }

                case 'brain_remember': {
                    const text = args.text || args.value || '';
                    const category = args.category || 'preference';
                    let key = args.key || args.identifier || null;

                    if (!key) {
                        key = text.toLowerCase()
                            .replace(/[^\w\s]/g, '')
                            .trim()
                            .split(/\s+/)
                            .slice(0, 4)
                            .join('_');
                    }

                    if (category === 'preference' || category === 'fact' || category === 'tech_stack' || category === 'test') {
                        this.profile.setFact(key, text, category, 1.0, 'agent_remember');
                    }

                    // Also store as semantic knowledge for neural retrieval
                    const insertId = await this.semantic.addItem({
                        title: text.slice(0, 50),
                        content: text,
                        category: category === 'rule' ? 'rule' : 'fact',
                        tags: args.tags || category,
                        source: 'agent_remember',
                        importance: 1.5
                    });

                    // If relation is provided, also add to Knowledge Graph
                    if (args.relation && args.relation.source && args.relation.predicate && args.relation.target) {
                        this.semantic.addRelation(args.relation.source, args.relation.predicate, args.relation.target, { confidence: 1.0 });
                    }

                    resultText = `Đã chủ động ghi nhớ thành công (Letta-style): Key "${key}" vào Profile, Semantic Knowledge (ID #${insertId})${args.relation ? ' và Đồ thị quan hệ thực thể' : ''}.`;
                    break;
                }

                case 'brain_forget': {
                    const key = args.key || args.identifier || '';
                    const target = args.target || null;
                    const reason = args.reason || 'User requested forgetting or obsolete';

                    let deletedProfile = false;
                    if (this.profile.get(key)) {
                        this.profile.deleteFact(key);
                        deletedProfile = true;
                    }

                    // If target specified, expire entity relation
                    let expiredRel = false;
                    if (target) {
                        expiredRel = this.semantic.expireRelation(key, 'prefers', target) ||
                                     this.semantic.expireRelation(key, 'uses', target) ||
                                     this.semantic.expireRelation(key, 'located_in', target);
                    }

                    // Cascade forget to Semantic Knowledge Items
                    let deletedKnowledge = false;
                    try {
                        const knMatches = this.db.all('SELECT id FROM knowledge_items WHERE title = ? OR title LIKE ? OR tags LIKE ?', key, `%${key}%`, `%${key}%`);
                        for (const km of knMatches) {
                            this.semantic.deleteItem(km.id);
                            deletedKnowledge = true;
                        }
                    } catch (e) {}

                    // Cascade forget to Procedural Solutions
                    let deletedSolution = false;
                    try {
                        const solMatches = this.db.all('SELECT id FROM solutions WHERE error_pattern = ? OR error_pattern LIKE ?', key, `%${key}%`);
                        for (const sm of solMatches) {
                            this.solutions.deleteSolution(sm.id);
                            deletedSolution = true;
                        }
                    } catch (e) {}

                    resultText = `Đã thực hiện gỡ bỏ/hết hiệu lực toàn diện (Letta-style): ` +
                        `${deletedProfile ? `Profile key "${key}" đã xóa. ` : ''}` +
                        `${deletedKnowledge ? `Tri thức ngữ nghĩa liên quan "${key}" đã xóa khỏi CSDL và FTS. ` : ''}` +
                        `${deletedSolution ? `Giải pháp thủ tục liên quan "${key}" đã xóa. ` : ''}` +
                        `${expiredRel ? `Quan hệ thực thể với "${target}" đã chuyển sang trạng thái expired. ` : ''}` +
                        `(Lý do: ${reason})`;
                    break;
                }

                case 'brain_learn_fix': {
                    const id = this.solutions.addSolution({
                        error_pattern: args.error_pattern,
                        solution_code: args.solution_code,
                        command_fix: args.command_fix || args.solution_code,
                        root_cause: args.root_cause || '',
                        project_scope: args.project_scope || 'global',
                        tags: 'learned_fix,agent_self_edit'
                    });
                    resultText = `Đã chủ động lưu giải pháp sửa lỗi mới vào Procedural Memory (ID #${id}):\n• Mẫu lỗi: "${args.error_pattern}"\n• Lệnh sửa: ${args.command_fix || args.solution_code}`;
                    break;
                }

                default:
                    this.sendResponse({
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: -32602,
                            message: `Unknown tool: ${name}`
                        }
                    });
                    return;
            }

            this.sendResponse({
                jsonrpc: '2.0',
                id,
                result: {
                    content: [
                        {
                            type: 'text',
                            text: resultText
                        }
                    ]
                }
            });
        } catch (err) {
            this.sendResponse({
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32000,
                    message: `Internal tool error: ${err.message}`
                }
            });
        }
    }
}

if (require.main === module) {
    const server = new SecondBrainMCPServer();
    server.start();
}

module.exports = { 
    SecondBrainMCPServer,
    TOOLS,
    PKG_VERSION
};
