# Second Brain Codebase Architecture & System State Investigation Report

## 1. Observation

### 1.1 Repository Structure & Module Map
The repository at `C:\Users\tvu16\.gemini\antigravity\second_brain` contains:
```
second_brain/
├── brain.db                       # Active SQLite WAL database (~1,100 KB)
├── brain.db-shm, brain.db-wal     # SQLite WAL auxiliary files
├── cli.js                         # CLI administration & sync tool (331 lines)
├── mcp_server.js                  # Stdio JSON-RPC MCP server (454 lines)
├── dashboard.html                 # Physics force-directed HTML graph dashboard (~81 KB)
├── profile.json, profile.md       # Root mirror files of Tier 0 user profile
├── CHANGELOG.md                   # System evolution log through v2.0
├── db/
│   └── schema.sql                 # Primary DDL schema (199 lines)
├── src/
│   ├── db.js                      # Node 24 native node:sqlite DatabaseSync wrapper (114 lines)
│   ├── embedding.js               # 384-dim vector bridge, LRU cache & fallback (202 lines)
│   ├── embedding_daemon.py        # Python fastembed MiniLM-L12-v2 HTTP server (140 lines)
│   ├── profile.js                 # Tier 0 User Profile Manager (126 lines)
│   ├── episodic.js                # Tier 2 Episodic Memory & transcript ingestion (216 lines)
│   ├── semantic.js                # Tier 3 Semantic Knowledge & Hybrid Search (273 lines)
│   ├── solutions.js               # Tier 4 Procedural Memory & Bug Solution Store (134 lines)
│   ├── retriever.js               # Multi-signal context compiler & compressor (133 lines)
│   ├── extractor.js               # Autonomous reflection & regex extractor (164 lines)
│   ├── consolidation.js           # Memory consolidation, deduplication & decay (132 lines)
│   ├── reinforcement.js           # Transcript error-to-fix miner (127 lines)
│   ├── backup.js                  # SQLite VACUUM INTO snapshot manager (108 lines)
│   ├── git_backup.js              # Git versioning & human-readable diff exporter (349 lines)
│   └── export_dashboard.js        # Generative UI HTML dashboard compiler (734 lines)
├── hooks/
│   ├── pre_invocation.js          # PreInvocation hook injecting context (79 lines)
│   └── stop.js                    # Stop hook executing reflection & auto-sync (100 lines)
├── integrations/
│   ├── hooks.json                 # Antigravity hook registration config
│   ├── mcp_config.json            # Antigravity MCP server definitions
│   ├── restore.ps1                # 1-click restore script for settings
│   ├── mcp_schemas/               # 11 MCP tool JSON schema contracts
│   └── skills/second-brain/       # Copied second-brain skill documentation
├── scripts/
│   └── auto_backup.ps1            # Daily scheduled maintenance script
├── test/
│   ├── test_brain.js              # 9-step automated test suite (129 lines)
│   ├── test_embed_api.js          # Direct HTTP embedding endpoint test (35 lines)
│   ├── test_hook.js               # PreInvocation hook child_process runner (29 lines)
│   └── test_mcp.js                # MCP JSON-RPC stdio protocol test (68 lines)
├── exports/                       # JSON & SQL text diff snapshots for Git
└── backups/                       # Hot-backup SQLite database copies
```

### 1.2 Storage Backends & Data Layer
- **SQLite Engine (`src/db.js:6-37`)**:
  - Uses Node 24 native `node:sqlite` (`DatabaseSync`). Zero external npm dependencies.
  - Pragmas: `WAL` journal mode, `synchronous = NORMAL`, `cache_size = -64000` (~64MB), `temp_store = MEMORY`, `mmap_size = 268435456` (256MB), `foreign_keys = ON`.
  - Live data counts in `brain.db` (verified via `node cli.js stats`):
    - `user_profile`: 12 items (identity, tone, language, environment, location).
    - `knowledge_items`: 11 items.
    - `solutions`: 15 procedural solutions.
    - `episodes`: 1,193 conversation messages.
    - `conversations`: 19 sessions.
    - `backups`: 5 snapshots.
- **Vector Storage**:
  - No external vector DB (no Chroma/FAISS/Milvus).
  - Vectors stored as binary blobs in `knowledge_items.embedding` (`BLOB`, 1,536 bytes = 384 dimensions x 4 bytes `Float32Array`).
  - Search method: In-memory brute-force linear loop (`src/semantic.js:180-200`) calculating cosine similarity against every row in `knowledge_items`.
  - Notice: `episodes` table has **no embedding column**. Episodic search is purely FTS5 BM25.
- **Embedding Provider (`src/embedding.js` & `src/embedding_daemon.py`)**:
  - Local Python HTTP daemon on `127.0.0.1:49152` hosting `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` via `fastembed` 0.8.0.
  - Endpoints: `GET /health`, `POST /embed` (accepts `{ texts: [...] }`, returns `{ embeddings: [...] }`).
  - Node caching: `_embeddingCache` in `src/embedding.js:17` with capacity 1,000.
  - Fallback: `computeFallbackVector(text)` in `src/embedding.js:84` generates pseudo-vectors via Murmur hash tokens if daemon does not reply within 1,200ms.

### 1.3 Retrieval Logic
- **Hybrid Search in `src/semantic.js:143-224`**:
  - Step 1: Compute query embedding (via daemon or fallback).
  - Step 2: Full-text search on `knowledge_fts` with prefix OR (`"w1"* OR "w2"*`), obtaining `bm25(knowledge_fts)` as `rawBm25`.
  - Step 3: Compute dense cosine similarity for all rows:
    $$\text{denseScore} = \max(0, \text{cosineSimilarity}(queryVec, itemVec))$$
  - Step 4: Normalize BM25:
    $$\text{sparseScore} = \min(1.0, \frac{|rawBm25|}{10.0})$$
  - Step 5: Hybrid score:
    $$\text{hybridScore} = (\text{denseScore} \times 0.50) + (\text{sparseScore} \times 0.35) + (\text{importance} \times 0.15)$$
    *Note*: In `src/semantic.js:195`, `const recency = 1.0 / (1.0 + ageHours / 168.0);` is computed, but it is **never used** in line 199.
- **Context Compiler in `src/retriever.js:32-117`**:
  - Priority 1: User profile summary (mandatory).
  - Priority 2: Procedural solutions (if query matches operational regex: `/(?:lỗi|error|fail|bug|exception|cannot|không thể|fix|sửa|lệnh|command|npm|git|node|powershell|sql|run|script|build|test)/i`).
  - Priority 3: Semantic knowledge items (hybrid search, top 4).
  - Priority 4: Episodic past conversation history (FTS5 search, top 3).
  - Compression: Default budget `DEFAULT_MAX_TOKENS = 800` (~2,800 characters at 3.5 chars/token). Sections appended sequentially until character cap is reached.

### 1.4 Reflection & Memory Consolidation Logic
- **Extraction (`src/extractor.js:21-132`)**:
  - Handled by regular expressions matching Vietnamese patterns:
    - Location: `/(?:tôi|mình)\s+(?:ở|sống tại|đang ở)\s+([A-ZÀ-Ỵa-zà-ỹ0-9\s,]{3,35})/i`
    - Tech preference: `/(?:tôi|mình)\s+(?:thích dùng|thường dùng|chuyên dùng|thích code|viết bằng|code bằng)\s+([A-Za-z0-9+#.\s]{2,40})/i`
    - Active project: `/(?:tôi|mình)\s+(?:đang làm|đang build|đang phát triển|đang làm dự án)\s+([A-ZÀ-Ỵa-zà-ỹ0-9_\-\s]{3,40})/i`
    - Permanent directive: `/(?:hãy luôn|từ nay luôn|nhớ luôn|sau này hãy|luôn luôn)\s+([A-ZÀ-Ỵa-zà-ỹ0-9_,\s]{8,120})/i`
    - Bug solution: `/(?:cách sửa lỗi|fix lỗi|sửa lỗi|khắc phục lỗi)\s+([A-Za-z0-9_.\s\-:]{3,60})\s*[:\-=➔]\s*([\s\S]+)/i`
    - Explicit memory: `/(?:ghi nhớ|lưu vào bộ nhớ|nhớ kỹ)(?:\s*(?:điều này|rằng|giúp tôi)?\s*[:\-])\s*([\s\S]+)/i`
  - Autonomous Tool Reinforcement (`src/reinforcement.js:15-94`):
    - Parses `transcript.jsonl` from conversation logs.
    - If a `run_command` fails with non-zero exit code or error keywords, and a subsequent `run_command` exits with code 0, it extracts the command as a fix and inserts it into `solutions`.
- **Consolidation (`src/consolidation.js:13-116`)**:
  - Summarization: Joins up to 3 user prompts and 3 assistant responses with template strings.
  - Deduplication: `GROUP BY LOWER(TRIM(title)) HAVING cnt > 1`. Keeps the item with highest ID, deleting earlier ones.
  - Decay: Hardcoded filter `WHERE (tags LIKE '%weather%' OR tags LIKE '%thoi_tiet%' OR category = 'temporary') AND updated_at < 48h` reduces importance by 50%.
  - Prune: Deletes rows where `importance <= 0.3 AND access_count = 0 AND updated_at < 30 days`.
  - Optimization: Runs `PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE);`.

### 1.5 MCP Server Implementation (`mcp_server.js`)
Exposes 11 tools over stdio with JSON-RPC 2.0:
1. `brain_search` (args: `query` [string], `scope` ['all'|'knowledge'|'conversations'], `limit` [int]).
2. `brain_store` (args: `title` [string], `content` [string], `category` ['fact'|'decision'|'snippet'|'rule'|'note'|'concept'], `tags` [string], `importance` [number]).
3. `brain_delete` (args: `id` [int]).
4. `brain_profile_get` (args: none).
5. `brain_profile_set` (args: `key` [string], `value` [string], `category` ['identity'|'preference'|'tech_stack'|'environment'|'style'|'general']).
6. `brain_conversation_history` (args: `query` [string], `limit` [int]).
7. `brain_solution_search` (args: `query` [string], `project_scope` [string], `limit` [int]).
8. `brain_solution_store` (args: `error_pattern` [string], `solution_code` [string], `root_cause` [string], `command_fix` [string], `project_scope` [string], `tags` [string]).
9. `brain_stats` (args: none).
10. `brain_git_backup` (args: `message` [string]).
11. `brain_git_status` (args: none).

### 1.6 CLI Implementation (`cli.js`)
Supports 16 commands:
- `sync`: Calls `episodic.syncAllConversations()`.
- `stats`: Displays profile, knowledge, solutions, episodes, convs, vector dim, db size.
- `profile`: Dumps `user_profile` table.
- `search <query>`: Dual search on knowledge (hybrid) and episodes (FTS5).
- `solutions`: Lists procedural solutions.
- `solution <error>`: FTS5 query on `solutions`.
- `store <title> <text>`: Adds knowledge item.
- `backup`: Calls `backup.createBackup()`.
- `backups`: Lists backup directory.
- `compact`: Calls `consolidation.consolidate()`.
- `dashboard`: Exports data and launches browser with `dashboard.html`.
- `reembed`: Recomputes all knowledge vectors.
- `git-backup [msg]`: Exports text diffs and commits to Git.
- `git-status`: Inspects repository status.
- `git-remote <url>`: Sets Git remote.
- `git-push`: Pushes to Git remote.

### 1.7 Current Defects & Verification Test Run
- **Test execution failure (`test/test_brain.js`)**:
  - Running `node test/test_brain.js` immediately throws:
    `AssertionError [ERR_ASSERTION]: Phải tạo thành công item ID at runTests (line 60)`
  - Cause: `semantic.addItem` is an `async` function, but `test_brain.js:53` calls `const id = semantic.addItem(...)` without `await`. The assigned value is a pending `Promise`, making `assert.ok(id > 0)` fail.
  - Furthermore, `test_brain.js:71` calls `semantic.getRelationsForEntity('Ngài')`, but that method **does not exist** on `SemanticKnowledge` (`src/semantic.js`).
  - In `test_brain.js:91`, `retriever.compileContext` is `async` and called without `await`.
  - In `test_brain.js:116`, assertion checks for string `PROCEDURAL MEMORY`, but `src/retriever.js:56` produces `[BỘ NHỚ KINH NGHIỆM ĐÃ HỌC (PROCEDURAL FIXES & LESSONS)]`.
- **Database Column Name Inconsistency (`src/semantic.js:240-255` vs `db/schema.sql:103-112`)**:
  - `schema.sql` defines: `source_entity`, `relation`, `target_entity`, `confidence`.
  - `src/semantic.js:242` runs: `INSERT INTO entity_relations (source, relation, target, weight)...`
  - `src/semantic.js:255` runs: `SELECT source, relation, target, weight FROM entity_relations`
  - Direct execution in node confirms: `sem.addRelation(...)` returns `false` due to column mismatch, and `sem.getGraph()` throws `getGraph error: no such column: source`.

---

## 2. Logic Chain

1. **Storage & Embedding Architecture**:
   - The current architecture prioritizes zero-dependency native Node.js operation (`node:sqlite`). This guarantees fast startup, no npm install overhead, and zero dependency rot.
   - However, dense vector search is executed via an unindexed in-memory linear array iteration over `knowledge_items`. For current scale (11 items), execution is sub-millisecond (< 1ms). If knowledge items grow to thousands or tens of thousands, linear iteration will degrade latency.
   - Crucially, `episodes` (1,193 records) contains no vector embeddings at all; episodic retrieval relies entirely on FTS5 BM25. A user query expressing a past concept without matching the exact keywords will fail to retrieve the corresponding conversation.

2. **Scoring & Fusion Flaws**:
   - The BM25 score normalization `Math.min(1.0, rawBm25 / 10.0)` is arbitrary. BM25 values from SQLite FTS5 are unbounded negative numbers whose distribution depends on document lengths and corpus size.
   - The `recency` decay calculation in `src/semantic.js:195` is calculated but completely dropped from the weighted equation in line 199.
   - Modern SOTA architectures (such as Mem0, Zep, and LangMem) utilize Reciprocal Rank Fusion (RRF) or calibrated hybrid scoring (dense score + BM25 reciprocal rank + access frequency + exponential decay).

3. **Extraction & Reflection Fragility**:
   - Current reflection in `src/extractor.js` relies on rigid Vietnamese regexes. Any English phrasing, indirect statement, conversational paraphrase, or multi-turn context is ignored.
   - There is no fact deduplication or semantic contradiction resolution at insertion time. If the user states "I moved from Hanoi to Danang", the system either appends a new fact or overwrites based on exact key equality without maintaining temporal history or resolving conflicting statements.
   - Modern systems (Mem0/LangMem/Letta) implement an LLM-assisted or semantic extraction pipeline with an explicit tripartite decision: `ADD` (new fact), `UPDATE` (supersedes old fact), `DELETE` (retracted fact).

4. **Reliability & Concurrency**:
   - The Python `embedding_daemon.py` uses Python's standard library `http.server.HTTPServer`, which is synchronous and single-threaded. If an incoming connection is aborted by the client's timeout controller (as seen in `src/embedding.js:121`), it raises `ConnectionResetError` on Windows.
   - Background daemon spawning via WMI `Win32_Process.Create` is asynchronous. Short-lived CLI commands (such as `node cli.js search ...`) execute and exit before the daemon can bind to port 49152, resulting in recurring fallback vector usage for cold CLI calls.

---

## 3. Caveats

1. **Live Production Database**: The file `brain.db` is an active database containing real user data and history (1,193 episodes, 12 profile items, 15 solutions). Any refactoring, schema changes, or indexing optimizations must maintain 100% zero-data-loss integrity and schema backward-compatibility.
2. **Execution Environment**: The host OS is Windows 11 with PowerShell. Node.js is v24.2.0 (running via `node` or `agy-node`). Python is managed via `uv` at `C:\Users\tvu16\AppData\Local\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe\uv.exe`.
3. **Investigation Boundary**: The analysis was strictly read-only. No source files were modified during this exploration.

---

## 4. Conclusion

The Second Brain repository has a clean, resilient, and zero-dependency foundation based on native `node:sqlite` in WAL mode with FTS5 triggers, dual export systems, Git snapshot versioning, and MCP/CLI interfaces.

However, four structural limitations must be addressed during the optimization phase:
1. **Retrieval**: Retrieval in `src/semantic.js` uses an unindexed linear scan for vectors, lacks vector search for episodic memory, uses arbitrary BM25 normalization, and drops the computed recency factor. Adopting Reciprocal Rank Fusion (RRF), semantic episodic search, and calibrated hybrid weighting will significantly improve Recall@K and MRR.
2. **Reflection**: Extraction in `src/extractor.js` is limited to rigid regex rules. Upgrading to a structured, multi-signal extraction engine (with ADD/UPDATE/DELETE classification and English/Vietnamese multilingual support) is needed to match Mem0/Letta capabilities.
3. **Consistency Bugs**: The column mismatch in `entity_relations` (`src/semantic.js` vs `db/schema.sql`) breaks graph operations (`addRelation`, `getGraph`), and `test/test_brain.js` is broken due to unhandled Promises and missing methods.
4. **Evaluation**: There is currently no automated evaluation suite measuring quantitative retrieval performance (Recall@K, MRR, latency) or reflection accuracy. A dedicated benchmarking runner must be created as requested in R3.

All existing MCP tool contracts (11 tools) and CLI commands (16 commands) must be preserved with 100% backward compatibility as specified in R4.

---

## 5. Verification Method

To independently verify all observations and conclusions stated in this report:

1. **Verify Database Structure and Live Stats**:
   ```powershell
   node "C:\Users\tvu16\.gemini\antigravity\second_brain\cli.js" stats
   node "C:\Users\tvu16\.gemini\antigravity\second_brain\cli.js" profile
   ```
2. **Verify `test/test_brain.js` Failure**:
   ```powershell
   node "C:\Users\tvu16\.gemini\antigravity\second_brain\test\test_brain.js"
   ```
   *Expected result*: Throws `AssertionError [ERR_ASSERTION]: Phải tạo thành công item ID at runTests (line 60)` due to un-awaited `semantic.addItem`.
3. **Verify `entity_relations` Column Mismatch**:
   ```powershell
   node -e "const { getSemanticKnowledge } = require('./src/semantic'); const sem = getSemanticKnowledge(); console.log(sem.addRelation('A', 'uses', 'B'));"
   node -e "const { getSemanticKnowledge } = require('./src/semantic'); const sem = getSemanticKnowledge(); console.log(sem.getGraph());"
   ```
   *Expected result*: `addRelation` outputs `false`; `getGraph` throws `no such column: source`.
4. **Verify Embedding Daemon Integration & Quality**:
   ```powershell
   node "C:\Users\tvu16\.gemini\antigravity\second_brain\test\test_embed_api.js"
   ```
   *Expected result*: If daemon is running, prints cosine similarity (~0.49 for related concepts, ~ -0.03 for unrelated). If daemon is down, prints `ECONNREFUSED`.
5. **Verify MCP Tool Signatures & Server Response**:
   ```powershell
   node "C:\Users\tvu16\.gemini\antigravity\second_brain\test\test_mcp.js"
   ```
   *Expected result*: Returns JSON-RPC 2.0 responses for `initialize`, `tools/list` (11 tools), and `tools/call` (`brain_stats`).
