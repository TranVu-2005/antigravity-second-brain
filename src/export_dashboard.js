// ==============================================================================
// Antigravity Second Brain: Interactive Visual Dashboard Generator (Generative UI)
// Generates a fully interactive Physics-based Knowledge Graph & Semantic Explorer
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getDB, BRAIN_DIR } = require('./db');
const { getProfileManager } = require('./profile');
const { getBackupManager } = require('./backup');

function generateDashboard(targetPaths = []) {
    const db = getDB();
    const profile = getProfileManager().getAll();
    const knowledge = db.all('SELECT id, title, content, category, tags, source, importance, project_scope, created_at, updated_at FROM knowledge_items ORDER BY importance DESC, updated_at DESC');
    const totalEpisodesCount = db.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
    const totalConversationsCount = db.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
    const episodes = db.all(`
        SELECT e.id, e.conversation_id, e.step_index, e.role, e.summary, e.content, e.timestamp, c.title as conv_title 
        FROM episodes e 
        JOIN conversations c ON e.conversation_id = c.id 
        ORDER BY e.timestamp DESC LIMIT 50
    `);
    const entities = db.all('SELECT * FROM entities');
    const relations = db.all('SELECT * FROM entity_relations');
    const backups = getBackupManager().listBackups();
    const solutions = db.all('SELECT * FROM solutions ORDER BY success_count DESC, updated_at DESC');
    const embRow = db.get('SELECT length(embedding) as len FROM knowledge_items WHERE embedding IS NOT NULL LIMIT 1');
    const actualDim = (embRow && embRow.len) ? (embRow.len / 4) : 384;

    const dataBundle = {
        generatedAt: new Date().toLocaleString(),
        totalEpisodesCount,
        totalConversationsCount,
        actualDim,
        profile,
        knowledge,
        solutions,
        episodes,
        entities,
        relations,
        backups
    };

    const dataJson = JSON.stringify(dataBundle);

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Antigravity Second Brain | Interactive Knowledge Nexus</title>
    <style>
        :root {
            --bg-base: #07090e;
            --bg-surface: #0e131f;
            --bg-card: rgba(18, 24, 38, 0.75);
            --border: rgba(56, 189, 248, 0.2);
            --border-hover: rgba(56, 189, 248, 0.5);
            --cyan: #38bdf8;
            --purple: #a855f7;
            --emerald: #10b981;
            --amber: #f59e0b;
            --rose: #f43f5e;
            --text: #f8fafc;
            --text-dim: #94a3b8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        body { background: var(--bg-base); color: var(--text); min-height: 100vh; overflow-x: hidden; }

        /* Top Header */
        header {
            padding: 20px 32px;
            background: rgba(14, 19, 31, 0.85);
            border-bottom: 1px solid var(--border);
            backdrop-filter: blur(12px);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .brand h1 {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, #38bdf8, #c084fc, #34d399);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .brand p { font-size: 13px; color: var(--text-dim); margin-top: 3px; }
        .badge {
            background: rgba(56, 189, 248, 0.12);
            color: var(--cyan);
            border: 1px solid var(--border);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);
        }

        /* Container */
        .container { padding: 24px 32px; max-width: 1700px; margin: 0 auto; }

        /* KPI Cards */
        .kpi-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .kpi-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px 20px;
            backdrop-filter: blur(8px);
            transition: all 0.25s ease;
        }
        .kpi-card:hover { transform: translateY(-3px); border-color: var(--cyan); }
        .kpi-label { font-size: 12px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.8px; }
        .kpi-value { font-size: 26px; font-weight: 800; color: #fff; margin-top: 6px; }

        /* Main Workspace Grid */
        .grid-workspace {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: 24px;
            height: calc(100vh - 230px);
            min-height: 600px;
        }

        .panel {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            backdrop-filter: blur(12px);
        }
        .panel-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .panel-title { font-size: 16px; font-weight: 700; color: var(--cyan); display: flex; align-items: center; gap: 8px; }

        /* Interactive Graph Viewport */
        .graph-viewport {
            flex: 1;
            position: relative;
            background: radial-gradient(circle at 50% 50%, rgba(14, 24, 45, 0.6) 0%, rgba(7, 9, 14, 0.95) 100%);
            overflow: hidden;
            cursor: grab;
        }
        .graph-viewport:active { cursor: grabbing; }
        canvas { width: 100%; height: 100%; display: block; }

        .graph-controls {
            position: absolute;
            bottom: 16px;
            left: 16px;
            display: flex;
            gap: 8px;
            z-index: 10;
        }
        .ctrl-btn {
            background: rgba(14, 19, 31, 0.85);
            border: 1px solid var(--border);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .ctrl-btn:hover { background: var(--cyan); color: #000; }

        /* Sidebar Tabs & Lists */
        .tabs { display: flex; border-bottom: 1px solid var(--border); }
        .tab-btn {
            flex: 1;
            padding: 12px;
            background: transparent;
            border: none;
            color: var(--text-dim);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        .tab-btn.active { color: var(--cyan); border-bottom-color: var(--cyan); background: rgba(56, 189, 248, 0.05); }

        .tab-content { flex: 1; overflow-y: auto; padding: 16px; display: none; }
        .tab-content.active { display: block; }

        .search-input {
            width: 100%;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: #fff;
            font-size: 13px;
            margin-bottom: 12px;
            outline: none;
        }
        .search-input:focus { border-color: var(--cyan); }

        .item-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .item-card:hover { border-color: var(--cyan); transform: translateY(-2px); background: rgba(56, 189, 248, 0.04); }
        .item-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .item-desc { font-size: 12px; color: var(--text-dim); line-height: 1.4; }
        .item-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.2); color: #d8b4fe; display: inline-block; margin-top: 6px; }

        /* Node Inspector Overlay */
        .inspector {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 280px;
            background: rgba(14, 19, 31, 0.92);
            border: 1px solid var(--cyan);
            border-radius: 10px;
            padding: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            display: none;
            z-index: 20;
            backdrop-filter: blur(10px);
        }
        .inspector-title { font-size: 16px; font-weight: 700; color: #fff; }
        .inspector-type { font-size: 11px; text-transform: uppercase; color: var(--purple); font-weight: 700; margin-top: 2px; }
        .inspector-body { font-size: 13px; color: var(--text-dim); margin-top: 10px; line-height: 1.4; }
        .inspector-close { position: absolute; top: 10px; right: 12px; background: transparent; border: none; color: #fff; font-size: 16px; cursor: pointer; }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <h1>ANTIGRAVITY SECOND BRAIN</h1>
            <p>Knowledge Nexus & Cognitive Graph — Kính phục vụ Ngài</p>
        </div>
        <span class="badge">PRODUCTION READY • v2.0 (${dataBundle.actualDim}-dim Vectors)</span>
    </header>

    <div class="container">
        <!-- KPI Row -->
        <div class="kpi-row">
            <div class="kpi-card">
                <div class="kpi-label">Hồ Sơ Ngài (Identity)</div>
                <div class="kpi-value" id="kpiProfile">0</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid var(--purple);">
                <div class="kpi-label">Tri Thức Kỹ Thuật (Knowledge)</div>
                <div class="kpi-value" id="kpiKnowledge">0</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid var(--emerald);">
                <div class="kpi-label">Ký Ức Hội Thoại (Episodes)</div>
                <div class="kpi-value" id="kpiEpisodes">0</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid var(--amber);">
                <div class="kpi-label">Bản Sao Lưu An Toàn</div>
                <div class="kpi-value" id="kpiBackups">0</div>
            </div>
        </div>

        <!-- Main Grid -->
        <div class="grid-workspace">
            <!-- Left Panel: Interactive Graph -->
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">🌐 Sơ Đồ Thực Thể Tương Tác (Interactive Knowledge Graph)</div>
                    <span style="font-size: 12px; color: var(--text-dim);">Kéo / Thả / Bấm vào node để khám phá liên kết</span>
                </div>
                <div class="graph-viewport" id="viewport">
                    <canvas id="graphCanvas"></canvas>
                    
                    <div class="graph-controls">
                        <button class="ctrl-btn" onclick="resetGraph()">Khởi tạo lại</button>
                        <button class="ctrl-btn" onclick="togglePhysics()">Bật/Tắt Vật lý</button>
                    </div>

                    <div class="inspector" id="inspector">
                        <button class="inspector-close" onclick="closeInspector()">×</button>
                        <div class="inspector-title" id="inspName">Entity</div>
                        <div class="inspector-type" id="inspType">CONCEPT</div>
                        <div class="inspector-body" id="inspDesc">Description here</div>
                        <div id="inspRelations" style="margin-top: 12px; font-size: 12px; color: var(--cyan);"></div>
                    </div>
                </div>
            </div>

            <!-- Right Panel: Data Explorer -->
            <div class="panel">
                <div class="tabs">
                    <button class="tab-btn active" onclick="switchTab('knowledge')">Tri Thức</button>
                    <button class="tab-btn" onclick="switchTab('solutions')">Giải Pháp</button>
                    <button class="tab-btn" onclick="switchTab('profile')">Hồ Sơ</button>
                    <button class="tab-btn" onclick="switchTab('conversations')">Hội Thoại</button>
                </div>

                <!-- Tab 1: Knowledge -->
                <div class="tab-content active" id="tab-knowledge">
                    <input type="text" class="search-input" id="searchK" placeholder="🔍 Tìm tri thức, quyết định..." oninput="renderKnowledge()">
                    <div id="knowledgeList"></div>
                </div>

                <!-- Tab 2: Solutions (Procedural) -->
                <div class="tab-content" id="tab-solutions">
                    <input type="text" class="search-input" id="searchS" placeholder="🔍 Tìm lỗi, giải pháp fix..." oninput="renderSolutions()">
                    <div id="solutionsList"></div>
                </div>

                <!-- Tab 3: Profile -->
                <div class="tab-content" id="tab-profile">
                    <div id="profileList"></div>
                </div>

                <!-- Tab 4: Conversations -->
                <div class="tab-content" id="tab-conversations">
                    <div id="episodesList"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const BRAIN_DATA = ${dataJson};

        // Populate KPIs
        document.getElementById('kpiProfile').textContent = BRAIN_DATA.profile.length + ' mục';
        document.getElementById('kpiKnowledge').textContent = BRAIN_DATA.knowledge.length + ' bài (' + (BRAIN_DATA.actualDim || 384) + '-dim)';
        document.getElementById('kpiEpisodes').textContent = (BRAIN_DATA.totalEpisodesCount || BRAIN_DATA.episodes.length) + ' tin (' + (BRAIN_DATA.totalConversationsCount || 0) + ' phiên)';
        document.getElementById('kpiBackups').textContent = BRAIN_DATA.backups.length + ' snapshot';

        // Tab Switching
        function switchTab(name) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + name).classList.add('active');
        }

        // Render Knowledge List
        function renderKnowledge() {
            const query = (document.getElementById('searchK').value || '').toLowerCase();
            const container = document.getElementById('knowledgeList');
            container.innerHTML = '';

            const filtered = BRAIN_DATA.knowledge.filter(k => 
                (k.title||'').toLowerCase().includes(query) || (k.content||'').toLowerCase().includes(query)
            );

            for (const k of filtered) {
                const el = document.createElement('div');
                el.className = 'item-card';
                el.innerHTML = \`
                    <div class="item-title">\${k.title}</div>
                    <div class="item-desc">\${k.content.slice(0, 160)}...</div>
                    <span class="item-tag">\${k.category.toUpperCase()} | Score: \${k.importance}</span>
                \`;
                el.onclick = () => focusNodeByName(k.title);
                container.appendChild(el);
            }
        }
        renderKnowledge();

        // Render Profile List
        function renderProfile() {
            const container = document.getElementById('profileList');
            container.innerHTML = '';
            for (const p of BRAIN_DATA.profile) {
                const el = document.createElement('div');
                el.className = 'item-card';
                el.innerHTML = \`
                    <div class="item-title" style="color: var(--cyan); font-size: 13px;">\${p.category.toUpperCase()} • \${p.key}</div>
                    <div class="item-desc" style="color: #fff; margin-top: 4px;">\${p.value}</div>
                \`;
                container.appendChild(el);
            }
        }
        renderProfile();

        // Render Solutions List (Procedural Memory)
        function renderSolutions() {
            const query = (document.getElementById('searchS')?.value || '').toLowerCase();
            const container = document.getElementById('solutionsList');
            if (!container) return;
            container.innerHTML = '';

            const filtered = (BRAIN_DATA.solutions || []).filter(s => 
                (s.error_pattern||'').toLowerCase().includes(query) || (s.solution_code||'').toLowerCase().includes(query)
            );

            for (const s of filtered) {
                const el = document.createElement('div');
                el.className = 'item-card';
                el.innerHTML = \`
                    <div class="item-title" style="color: var(--amber); font-size: 13px;">🚨 \${s.error_pattern}</div>
                    <div class="item-desc" style="color: #e2e8f0; margin-top: 4px;"><strong>Fix:</strong> \${s.solution_code}</div>
                    \${s.command_fix ? \`<div style="font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 4px; margin-top: 6px; color: var(--cyan);">\${s.command_fix}</div>\` : ''}
                    <span class="item-tag">\${s.project_scope || 'global'} | Tự tin: \${Math.round(s.confidence * 100)}%</span>
                \`;
                container.appendChild(el);
            }
        }
        renderSolutions();

        // Render Episodes List
        function renderEpisodes() {
            const container = document.getElementById('episodesList');
            container.innerHTML = '';
            for (const e of BRAIN_DATA.episodes.slice(0, 20)) {
                const el = document.createElement('div');
                el.className = 'item-card';
                const roleColor = e.role === 'user' ? 'var(--cyan)' : 'var(--purple)';
                el.innerHTML = \`
                    <div class="item-title" style="font-size: 12px; color: \${roleColor};">[\${e.role.toUpperCase()}] \${e.conv_title || 'Phiên làm việc'}</div>
                    <div class="item-desc">\${e.summary || e.content.slice(0, 120)}</div>
                \`;
                container.appendChild(el);
            }
        }
        renderEpisodes();

        // =====================================================================
        // Interactive Force-Directed Physics Graph
        // =====================================================================
        const canvas = document.getElementById('graphCanvas');
        const ctx = canvas.getContext('2d');
        let width = canvas.parentElement.clientWidth;
        let height = canvas.parentElement.clientHeight;
        canvas.width = width;
        canvas.height = height;

        let physicsEnabled = true;

        // Build Graph Nodes from Entities & Knowledge
        const nodeMap = new Map();
        const nodes = [];
        const edges = [];

        function getOrCreateNode(name, type, color, r = 14) {
            if (nodeMap.has(name)) return nodeMap.get(name);
            const n = {
                id: name,
                name: name,
                type: type,
                x: width / 2 + (Math.random() - 0.5) * 300,
                y: height / 2 + (Math.random() - 0.5) * 300,
                vx: 0,
                vy: 0,
                r: r,
                color: color
            };
            nodeMap.set(name, n);
            nodes.push(n);
            return n;
        }

        // Add Entities
        for (const ent of BRAIN_DATA.entities) {
            let color = 'var(--cyan)';
            let r = 16;
            if (ent.name === 'Ngài') { color = '#38bdf8'; r = 24; }
            else if (ent.type === 'tool') { color = '#a855f7'; r = 18; }
            else if (ent.type === 'location') { color = '#f59e0b'; r = 15; }
            getOrCreateNode(ent.name, ent.type, color, r);
        }

        // Add Relations
        for (const rel of BRAIN_DATA.relations) {
            const s = getOrCreateNode(rel.source_entity, 'concept', '#38bdf8', 14);
            const t = getOrCreateNode(rel.target_entity, 'concept', '#10b981', 14);
            edges.push({ source: s, target: t, label: rel.relation });
        }

        // Connect Knowledge items to Ngài / Antigravity
        for (const k of BRAIN_DATA.knowledge) {
            const knNode = getOrCreateNode(k.title, k.category, '#c084fc', 11);
            const rootNode = nodeMap.get('Antigravity') || nodeMap.get('Ngài');
            if (rootNode) {
                edges.push({ source: rootNode, target: knNode, label: 'contains' });
            }
        }

        // Physics Simulation
        function updatePhysics() {
            if (!physicsEnabled) return;

            // Repulsion between all nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const na = nodes[i];
                    const nb = nodes[j];
                    const dx = nb.x - na.x;
                    const dy = nb.y - na.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    if (dist < 220) {
                        const force = (220 - dist) / dist * 0.08;
                        na.vx -= dx * force;
                        na.vy -= dy * force;
                        nb.vx += dx * force;
                        nb.vy += dy * force;
                    }
                }
            }

            // Spring attraction along edges
            for (const edge of edges) {
                const dx = edge.target.x - edge.source.x;
                const dy = edge.target.y - edge.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const targetDist = 110;
                const force = (dist - targetDist) * 0.03;
                edge.source.vx += dx / dist * force;
                edge.source.vy += dy / dist * force;
                edge.target.vx -= dx / dist * force;
                edge.target.vy -= dy / dist * force;
            }

            // Center gravity & update positions
            for (const n of nodes) {
                if (n === draggedNode) continue;
                n.vx += (width / 2 - n.x) * 0.002;
                n.vy += (height / 2 - n.y) * 0.002;
                n.vx *= 0.85; // damping
                n.vy *= 0.85;
                n.x += n.vx;
                n.y += n.vy;

                // Boundary bounds
                n.x = Math.max(n.r + 10, Math.min(width - n.r - 10, n.x));
                n.y = Math.max(n.r + 10, Math.min(height - n.r - 10, n.y));
            }
        }

        let selectedNode = null;

        function draw() {
            ctx.clearRect(0, 0, width, height);

            // Draw Edges
            for (const edge of edges) {
                ctx.beginPath();
                ctx.moveTo(edge.source.x, edge.source.y);
                ctx.lineTo(edge.target.x, edge.target.y);
                const isHighlight = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
                ctx.strokeStyle = isHighlight ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)';
                ctx.lineWidth = isHighlight ? 2.5 : 1;
                ctx.stroke();

                // Draw relation text if highlighted
                if (isHighlight && edge.label) {
                    const mx = (edge.source.x + edge.target.x) / 2;
                    const my = (edge.source.y + edge.target.y) / 2;
                    ctx.fillStyle = '#38bdf8';
                    ctx.font = '10px sans-serif';
                    ctx.fillText(edge.label, mx, my);
                }
            }

            // Draw Nodes
            for (const n of nodes) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = n.color;
                if (n === selectedNode) {
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 20;
                } else {
                    ctx.shadowColor = n.color;
                    ctx.shadowBlur = 8;
                }
                ctx.fill();
                ctx.shadowBlur = 0;

                // Border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = n === selectedNode ? 2.5 : 1;
                ctx.stroke();

                // Label
                ctx.fillStyle = '#f8fafc';
                ctx.font = (n.r > 16 ? 'bold 12px' : '10px') + ' sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(n.name.length > 18 ? n.name.slice(0, 16) + '..' : n.name, n.x, n.y + n.r + 14);
            }

            updatePhysics();
            requestAnimationFrame(draw);
        }

        // =====================================================================
        // Mouse Interactions: Drag & Drop + Node Inspector
        // =====================================================================
        let draggedNode = null;
        let isDragging = false;

        function getNodeAt(x, y) {
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                const dx = n.x - x;
                const dy = n.y - y;
                if (dx * dx + dy * dy <= (n.r + 5) * (n.r + 5)) {
                    return n;
                }
            }
            return null;
        }

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            draggedNode = getNodeAt(mx, my);
            if (draggedNode) {
                isDragging = true;
                selectedNode = draggedNode;
                showInspector(draggedNode);
            } else {
                selectedNode = null;
                closeInspector();
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging && draggedNode) {
                const rect = canvas.getBoundingClientRect();
                draggedNode.x = e.clientX - rect.left;
                draggedNode.y = e.clientY - rect.top;
                draggedNode.vx = 0;
                draggedNode.vy = 0;
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            draggedNode = null;
        });

        function showInspector(n) {
            const insp = document.getElementById('inspector');
            document.getElementById('inspName').textContent = n.name;
            document.getElementById('inspType').textContent = (n.type || 'CONCEPT').toUpperCase();
            
            // Find relations
            const connected = edges.filter(e => e.source === n || e.target === n);
            const relText = connected.map(e => {
                const other = e.source === n ? e.target.name : e.source.name;
                return '• ' + e.label + ' ➔ ' + other;
            }).join('<br>');

            document.getElementById('inspDesc').textContent = 'Thực thể đang kích hoạt trong mạng lưới tri thức.';
            document.getElementById('inspRelations').innerHTML = connected.length > 0 
                ? '<strong>Liên kết:</strong><br>' + relText 
                : 'Không có liên kết trực tiếp.';

            insp.style.display = 'block';
        }

        function closeInspector() {
            document.getElementById('inspector').style.display = 'none';
        }

        function focusNodeByName(name) {
            const n = nodes.find(node => node.name.toLowerCase().includes(name.toLowerCase()));
            if (n) {
                selectedNode = n;
                showInspector(n);
            }
        }

        function resetGraph() {
            for (const n of nodes) {
                n.x = width / 2 + (Math.random() - 0.5) * 300;
                n.y = height / 2 + (Math.random() - 0.5) * 300;
                n.vx = 0;
                n.vy = 0;
            }
        }

        function togglePhysics() {
            physicsEnabled = !physicsEnabled;
        }

        window.addEventListener('resize', () => {
            width = canvas.parentElement.clientWidth;
            height = canvas.parentElement.clientHeight;
            canvas.width = width;
            canvas.height = height;
        });

        draw();
    </script>
</body>
</html>`;

    // Save to primary Second Brain directory
    const outPath = path.join(BRAIN_DIR, 'dashboard.html');
    fs.writeFileSync(outPath, html, 'utf8');

    // Also write to any additional paths (e.g. artifact directory)
    for (const p of targetPaths) {
        try {
            fs.writeFileSync(p, html, 'utf8');
        } catch (e) {}
    }

    return outPath;
}

module.exports = { generateDashboard };

if (require.main === module) {
    const p = generateDashboard();
    console.log('Dashboard generated at:', p);
}
