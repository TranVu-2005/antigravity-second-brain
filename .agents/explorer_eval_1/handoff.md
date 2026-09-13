# Second Brain Evaluation Suite (Eval Suite) Specification & Benchmark Architecture

**Author:** explorer_eval_1 (Benchmark & Evaluation Explorer)  
**Date:** 2026-09-13T07:12:00Z  
**Target Milestone:** Comprehensive Evaluation Suite Design (R3 & R4)  
**Working Directory:** `C:\Users\tvu16\.gemini\antigravity\second_brain\.agents\explorer_eval_1`  
**Project Root:** `C:\Users\tvu16\.gemini\antigravity\second_brain`  

---

## 1. Observation

Direct code and database inspections yielded the following concrete baseline observations:

1. **Active Database State (`brain.db`):**
   - SQLite version running in WAL mode (`PRAGMA journal_mode=wal; PRAGMA foreign_keys=ON;`).
   - Production record inventory:
     * `user_profile`: 12 active records (categories: `identity`, `style`, `environment`, `preference`, `principle`, `tech_stack`).
     * `conversations`: 19 active sessions.
     * `episodes`: 1,193 dialogue turns indexed in `episodes_fts` (FTS5 BM25).
     * `knowledge_items`: 11 items indexed in `knowledge_fts` and dense vectors (384-dimensional).
     * `entities`: 3 entities (`Ngài`, `Antigravity`, `Hoàng Mai`).
     * `entity_relations`: 2 relations (`Ngài uses Antigravity`, `Ngài located_in Hoàng Mai`).
     * `solutions`: 15 procedural bug fixes indexed in `solutions_fts`.

2. **Existing Test Defect Observed in `test/test_brain.js:53-65`:**
   - In `test/test_brain.js`, line 53:
     ```javascript
     const id = semantic.addItem({ title: '...', ... });
     assert.ok(id > 0, 'Phải tạo thành công item ID');
     ```
   - In `src/semantic.js:88`:
     ```javascript
     async addItem({ title, content, category = 'fact', tags = '', source = 'user', importance = 1.0 }) { ... }
     ```
   - `addItem` and `searchKnowledge` (line 143) are `async` functions returning Promises. Because `test/test_brain.js` omitted `await`, `id` is a `Promise`, causing `assert.ok(id > 0)` to fail immediately (`Promise > 0` evaluates to `false`).
   - Verification command: `node test/test_brain.js` exited with code 1 (`ERR_ASSERTION: Phải tạo thành công item ID`).

3. **Current Retrieval Architecture (`src/retriever.js` & `src/semantic.js`):**
   - Scoring equation in `src/semantic.js:199`:
     $$\text{HybridScore} = (\text{DenseCosine} \times 0.50) + (\text{SparseBM25} \times 0.35) + (\text{ImportanceNorm} \times 0.15)$$
   - Dense vector dimension: 384-dim (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`), hosted via `src/embedding_daemon.py` on `http://127.0.0.1:49152/embed` with fallback hashing in `src/embedding.js:84`.
   - Context Compiler (`src/retriever.js:32-117`):
     * Hard ceiling default: `DEFAULT_MAX_TOKENS = 800` (~3200 characters).
     * Four prioritized tiers: Tier 0 (Core Profile) -> Tier 4 (Procedural Solutions if regex matches operational terms) -> Tier 3 (Semantic Knowledge) -> Tier 2 (Episodic History).

4. **Current Extraction Engine Defect (`src/extractor.js:27-103`):**
   - Extraction uses rigid regex heuristics without semantic validation.
   - Concrete artifact in production database (`solutions` table, ID 5):
     `error_pattern: 'Created At: 2026-09-11T23:49:33+07:00'` was extracted as a technical bug pattern due to regex capturing raw terminal header output.
   - Zero conflict resolution: when a preference changes, old keys remain or are overwritten without historical lineage.
   - Zero English or multi-turn conversational extraction support.

5. **Tooling & Interface Surface:**
   - 8 Core MCP Tools in `mcp_server.js:18-159`: `brain_search`, `brain_store`, `brain_profile_get`, `brain_profile_set`, `brain_conversation_history`, `brain_stats`, `brain_git_backup`, `brain_git_status` (plus extended tools: `brain_delete`, `brain_solution_search`, `brain_solution_store`).
   - 5 Core CLI Commands in `cli.js:48-324`: `sync`, `search`, `profile`, `stats`, `git-backup` (plus extended: `solutions`, `solution`, `store`, `compact`, `backup`, `backups`, `dashboard`, `reembed`).

---

## 2. Logic Chain

1. **From Test Failure Observation to Evaluation Architecture:**
   Because current unit tests had un-awaited asynchronous calls and lacked quantitative benchmarking, Second Brain had no empirical mechanism to evaluate whether a code change improved or degraded retrieval quality. A standardized, automated evaluation suite is required before any core optimization takes place.

2. **From Multi-Tier Memory to 4-Scenario Benchmark Queries:**
   Second Brain manages heterogeneous memory structures: structured profile key-values, unstructured knowledge articles, chronological conversation episodes, and procedural bug fixes. Therefore, single-keyword search tests are insufficient:
   - *Keyword-exact* evaluates FTS5 tokenization and BM25 index efficiency.
   - *Semantic / Paraphrased* evaluates dense multilingual vector alignment and cross-lingual understanding.
   - *Multi-hop / Relational* evaluates graph traversal across `entities` and `entity_relations`.
   - *Temporal / Chronological* evaluates recency decay curves and time-bounded episode filtering.

3. **From Extraction Noise Observation to Reflection Metric Design:**
   Because regex extractors can extract noisy false positives (e.g. timestamp strings), precision and recall must be evaluated separately from accuracy. Deduplication must be tested to ensure repeating user statements does not cause table bloat, and conflict resolution must be tested to ensure outdated facts are superseded cleanly.

4. **From Production Data Safety to Test Isolation & Regression Gating:**
   With 1,193 production episodes and active user profiles in `brain.db`, the evaluation runner must execute against isolated synthetic/fixture databases (`eval_temp_brain.db`) with zero mutations on production files. By saving baseline performance metrics to a versioned baseline file, the runner can enforce a strict regression gate in CI/CD.

---

## 3. Detailed Architecture Specification

### Part A: Retrieval Evaluation Architecture

#### A.1. Standard Information Retrieval Metrics
For each query $q \in Q$, let $\mathcal{R}_q$ be the ground-truth set of relevant memory IDs, and $\mathcal{L}_q = [d_1, d_2, \dots, d_K]$ be the ranked list of retrieved memory IDs.

1. **Recall@K ($K \in \{1, 3, 5, 10\}$):**
   $$\text{Recall}@K = \frac{1}{|Q|} \sum_{q \in Q} \frac{|\mathcal{L}_{q, 1..K} \cap \mathcal{R}_q|}{|\mathcal{R}_q|}$$
   Measures completeness of retrieval within the top $K$ candidate window.

2. **Precision@K ($K \in \{1, 3, 5, 10\}$):**
   $$\text{Precision}@K = \frac{1}{|Q|} \sum_{q \in Q} \frac{|\mathcal{L}_{q, 1..K} \cap \mathcal{R}_q|}{K}$$
   Measures retrieval density and signal-to-noise ratio in top results.

3. **MRR (Mean Reciprocal Rank):**
   $$\text{MRR} = \frac{1}{|Q|} \sum_{q \in Q} \frac{1}{\text{rank}_q}$$
   where $\text{rank}_q = \min \{ i \mid d_i \in \mathcal{R}_q \}$ (or $\frac{1}{\text{rank}_q} = 0$ if $(\mathcal{L}_q \cap \mathcal{R}_q) = \emptyset$). Focuses on how quickly the user encounters the first relevant memory.

4. **NDCG@K (Normalized Discounted Cumulative Gain):**
   With graded relevance $r_i \in \{0, 1, 2, 3\}$:
   $$\text{DCG}@K = \sum_{i=1}^K \frac{2^{r_i} - 1}{\log_2(i + 1)}, \quad \text{NDCG}@K = \frac{\text{DCG}@K}{\text{IDCG}@K}$$
   where $\text{IDCG}@K$ is the ideal DCG obtained by sorting items by true relevance.

5. **Query Latency Percentiles (p50, p95, p99 in ms):**
   Measured over $N \ge 3$ runs per query using high-resolution monotonic timer (`performance.now()`):
   - $T_{\text{embed}}$: Vector embedding inference latency.
   - $T_{\text{fts}}$: SQLite FTS5 BM25 query latency.
   - $T_{\text{scan}}$: Dense cosine distance computation & candidate scoring latency.
   - $T_{\text{total}}$: End-to-end retrieval and ranking latency.

#### A.2. Multi-Scenario Benchmark Queries & Ground-Truth Dataset
Stored at: `eval/datasets/retrieval_benchmark.json`

| Query ID | Scenario | Query String (Vietnamese / English) | Expected Target Table & Target ID / Key | Graded Rel | Hard Negatives / Distractors |
|---|---|---|---|---|---|
| `RET-KW-001` | Keyword-exact | `"screenoff.cmd"` | `knowledge_items`: [8, 9, 10] | 3 (ID 8), 2 (ID 9, 10) | ID 6 (temp.cmd) |
| `RET-KW-002` | Keyword-exact | `"EADDRINUSE 3000"` | `solutions`: [1] | 3 (ID 1) | Solution ID 2 |
| `RET-KW-003` | Keyword-exact | `"FastTemp ThreadPoolExecutor"` | `knowledge_items`: [11] | 3 (ID 11) | ID 6, ID 7 |
| `RET-KW-004` | Keyword-exact | `"antigravity-second-brain.git"` | `user_profile`: `second_brain_repo` | 3 | Profile `github_username` |
| `RET-SEM-001` | Semantic Paraphrase | `"nơi ở và làm việc hiện tại của Ngài"` | `user_profile`: `location`, `knowledge_items`: [3] | 3 (location), 2 (ID 3) | Episodes mentioning "Hà Nội" casually |
| `RET-SEM-002` | Semantic Paraphrase | `"cách tắt phụt màn hình laptop ngay lập tức"` | `knowledge_items`: [8, 10] | 3 (ID 8), 2 (ID 10) | Knowledge ID 6 (nhiệt độ) |
| `RET-SEM-003` | Semantic Paraphrase | `"nguyên tắc không được bịa đặt hay chém gió thông tin"` | `user_profile`: `honesty_policy`, `knowledge_items`: [2] | 3 (honesty_policy), 2 (ID 2) | Knowledge ID 1 (architecture) |
| `RET-SEM-004` | Semantic Paraphrase | `"how to resolve powershell single and double quote escaping bug"` | `solutions`: [1] | 3 (Solution ID 1) | Solution ID 3 (SQLite warning) |
| `RET-SEM-005` | Semantic Paraphrase | `"kiểm tra quạt gió và độ nóng CPU Lenovo Legion"` | `knowledge_items`: [6, 7, 11] | 3 (ID 7), 2 (ID 11, ID 6) | Knowledge ID 8 (screenoff) |
| `RET-MH-001` | Multi-hop / Relational | `"Các công cụ và nền tảng chính mà Ngài trực tiếp sử dụng để làm việc"` | Hop 1: `entities` (`Ngài` uses `Antigravity`) -> Hop 2: `knowledge_items`: [1, 5] | 3 (Entity link), 2 (ID 1, 5) | General tools |
| `RET-MH-002` | Multi-hop / Relational | `"Địa chỉ git repo của dự án Second Brain mà Ngài đang phát triển"` | Hop 1: `user_profile`: `second_brain_repo` + `github_username` -> Hop 2: `knowledge_items`: [1] | 3 (repo link), 2 (ID 1) | Generic git solutions |
| `RET-MH-003` | Multi-hop / Relational | `"Quy tắc ứng xử và phong cách giao tiếp khi phục vụ Ngài tại Hoàng Mai"` | Hop 1: `user_profile`: `honorific`, `tone_and_style` -> Hop 2: `knowledge_items`: [2, 3] | 3 (style), 2 (ID 2, 3) | Random episodes |
| `RET-TMP-001` | Temporal / Freshness | `"Bản cập nhật mới nhất của lệnh kiểm tra nhiệt độ phần cứng"` | `knowledge_items`: [11] (FastTemp), superseded [7], superseded [6] | 3 (ID 11), 1 (ID 7), 0 (ID 6) | ID 6 (old initial version) |
| `RET-TMP-002` | Temporal / Freshness | `"Lịch sử các phiên làm việc trong 24 giờ qua"` | `episodes`: matching `timestamp >= datetime('now', '-1 day')` | 3 (recent episodes) | Episodes older than 7 days |
| `RET-TMP-003` | Temporal / Freshness | `"Quy tắc điều khiển Legion Toolkit cập nhật gần đây nhất"` | `knowledge_items`: [10, 11] | 3 (ID 10, 11) | ID 8 (earlier snippet) |

---

### Part B: Reflection & Fact Extraction Evaluation Architecture

#### B.1. Extraction Metrics Formulation
1. **Precision ($\mathcal{P}_{\text{ext}}$):**
   $$\mathcal{P}_{\text{ext}} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Positives}}$$
   Penalizes noisy extractions (e.g. capturing CLI timestamps or non-factual chatter).

2. **Recall ($\mathcal{R}_{\text{ext}}$):**
   $$\mathcal{R}_{\text{ext}} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Negatives}}$$
   Penalizes missing key facts explicitly provided by the user.

3. **$F_1$-Score ($\mathcal{F}_{1,\text{ext}}$):**
   $$\mathcal{F}_{1,\text{ext}} = 2 \cdot \frac{\mathcal{P}_{\text{ext}} \cdot \mathcal{R}_{\text{ext}}}{\mathcal{P}_{\text{ext}} + \mathcal{R}_{\text{ext}}}$$

4. **Multi-Domain Metric Granularity:**
   - $\mathcal{F}_{1,\text{profile}}$: Profile attributes (`user_profile` table).
   - $\mathcal{F}_{1,\text{rule}}$: Directives & permanent rules (`knowledge_items` with category `rule`).
   - $\mathcal{F}_{1,\text{procedural}}$: Error-fix pairs (`solutions` table).
   - $\mathcal{F}_{1,\text{relation}}$: Entity-relation triples (`entity_relations` table).

#### B.2. Benchmark Dialogue Test Cases & Ground Truth
Stored at: `eval/datasets/reflection_benchmark.json`

1. **Dialogue D-01: Profile Expansion & Tech Preferences (Bilingual)**
   - Input Turn: *"Từ hôm nay mình sẽ tập trung code backend bằng Rust và Go, bỏ qua PHP nhé. Hãy ghi nhớ."*
   - Target Profile:
     * `tech_stack.backend`: `Rust, Go` (Confidence: 1.0)
     * Negation check: PHP removed or marked deprecated.
   - Ground Truth: $\text{TP} = 2$, $\text{FP} = 0$, $\text{FN} = 0$.

2. **Dialogue D-02: Permanent Directive & Persona Rule**
   - Input Turn: *"Ngươi nhớ kỹ: khi trả lời code, luôn luôn kèm theo unit test mẫu bằng Vitest hoặc Jest."*
   - Target Knowledge Item:
     * Category: `rule`
     * Title: `Quy tắc code: Luôn kèm unit test Vitest/Jest`
     * Importance: $\ge 1.8$
   - Ground Truth: $\text{TP} = 1$, $\text{FP} = 0$, $\text{FN} = 0$.

3. **Dialogue D-03: Procedural Bug Troubleshooting**
   - Input Dialogue:
     * *Assistant:* "Lỗi khi chạy Prisma migrate: P1001 Can't reach database server at localhost:5432"
     * *User:* "À lỗi này do Docker container postgres chưa start. Chỉ cần chạy 'docker start my-postgres' là kết nối lại bình thường."
   - Target Solution Store:
     * `error_pattern`: `Prisma P1001 Can't reach database server`
     * `root_cause`: `Docker container postgres chưa start`
     * `solution_code`: `Chạy docker start my-postgres`
     * `command_fix`: `docker start my-postgres`
   - Ground Truth: $\text{TP} = 1$, $\text{FP} = 0$, $\text{FN} = 0$.

4. **Dialogue D-04: Negative Control / Chatter (Zero-Extraction Test)**
   - Input Dialogue:
     * *User:* "Hôm nay trời nhiều mây quá, chắc lát nữa sẽ mưa to. Cậu có thấy đói bụng không?"
   - Target Extractions:
     * $\emptyset$ (Empty array).
   - Ground Truth: Any extraction generated is an immediate False Positive ($\text{FP} > 0 \implies \mathcal{P} = 0$).

5. **Dialogue D-05: Dynamic Conflict Resolution & Updating**
   - Turn 1: *"Tôi đang chuyển sang nghiên cứu AI memory ở Cầu Giấy."* -> Profile `location`: `Cầu Giấy`.
   - Turn 4: *"Thực ra tuần này tôi đã chuyển hẳn về sống và làm việc tại Hoàng Mai rồi, không còn ở Cầu Giấy nữa."*
   - Evaluation Criteria:
     * Clean update: Profile `location` is updated to `Hoàng Mai`.
     * No ghost records: Old location `Cầu Giấy` is not duplicated as an active secondary fact.
     * Historical audit: Update reflects higher timestamp/confidence.

---

### Part C: Automated Evaluation Runner Architecture

#### C.1. Directory & File Structure
```
eval/
├── run_eval.js                 # Unified CLI test runner & orchestrator
├── run_eval.py                 # Optional Python high-throughput benchmark runner
├── lib/
│   ├── metrics.js              # Vectorized Recall@K, MRR, NDCG@K, Latency stats
│   ├── test_environment.js    # In-memory / isolated SQLite sandbox builder
│   ├── retrieval_evaluator.js  # Runs queries against test DB & computes scores
│   ├── reflection_evaluator.js # Replays benchmark dialogues against extractor
│   └── reporter.js             # Terminal table printer & JSON report serializer
├── datasets/
│   ├── seed_database.sql       # Seed fixtures (profiles, knowledge, episodes, solutions)
│   ├── retrieval_benchmark.json# Ground-truth multi-scenario queries
│   └── reflection_benchmark.json# Ground-truth conversation dialogues
├── baselines/
│   └── v2.0_baseline.json      # Gold baseline metrics for regression gating
└── reports/                    # Auto-generated eval reports (git-ignored)
    └── eval_report_latest.json
```

#### C.2. Runner CLI Specification
```bash
# Full evaluation suite (Retrieval + Reflection + Backward Compatibility)
node eval/run_eval.js --suite all

# Retrieval benchmark only with custom top-K
node eval/run_eval.js --suite retrieval --top-k 10

# Reflection & extraction benchmark only
node eval/run_eval.js --suite reflection

# Regression gating against version baseline (exits with code 1 on regression)
node eval/run_eval.js --compare-baseline eval/baselines/v2.0_baseline.json --threshold 0.02

# Output structured report
node eval/run_eval.js --output eval/reports/eval_report_latest.json --format json
```

#### C.3. Output Format

**1. Structured JSON Report (`eval_report.json` Schema):**
```json
{
  "timestamp": "2026-09-13T07:15:00Z",
  "version": "2.1.0-optimized",
  "runtime": {
    "node": "v24.19.0",
    "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
    "vector_dim": 384,
    "daemon_healthy": true
  },
  "retrieval_metrics": {
    "overall": {
      "recall_at_1": 0.733,
      "recall_at_3": 0.867,
      "recall_at_5": 0.933,
      "recall_at_10": 1.000,
      "mrr": 0.814,
      "ndcg_at_5": 0.882,
      "latency_ms": { "p50": 18.2, "p95": 42.5, "p99": 68.1, "mean": 21.4 }
    },
    "by_scenario": {
      "keyword_exact": { "recall_at_3": 1.000, "mrr": 0.950, "p50_latency_ms": 4.1 },
      "semantic_paraphrase": { "recall_at_3": 0.850, "mrr": 0.810, "p50_latency_ms": 22.4 },
      "multi_hop": { "recall_at_3": 0.780, "mrr": 0.720, "p50_latency_ms": 28.6 },
      "temporal": { "recall_at_3": 0.840, "mrr": 0.780, "p50_latency_ms": 16.5 }
    }
  },
  "reflection_metrics": {
    "precision": 0.941,
    "recall": 0.923,
    "f1_score": 0.932,
    "deduplication_accuracy": 1.000,
    "conflict_resolution_accuracy": 1.000
  },
  "compatibility": {
    "mcp_tools_passed": 8,
    "mcp_tools_total": 8,
    "cli_commands_passed": 5,
    "cli_commands_total": 5,
    "schema_integrity": "PASSED"
  },
  "regression_check": {
    "status": "PASSED",
    "deltas": {
      "recall_at_5": "+0.066",
      "mrr": "+0.082",
      "f1_score": "+0.115",
      "latency_p95": "-8.2ms"
    }
  }
}
```

**2. Human-Readable Terminal Summary Table:**
```
==================================================================================================
🧠 ANTIGRAVITY SECOND BRAIN — BENCHMARK EVALUATION REPORT
==================================================================================================
Suite               Metric          Current    Baseline   Delta     Status
--------------------------------------------------------------------------------------------------
Retrieval           Recall@1        0.733      0.680      +0.053    ✅ PASS
Retrieval           Recall@3        0.867      0.800      +0.067    ✅ PASS
Retrieval           Recall@5        0.933      0.867      +0.066    ✅ PASS
Retrieval           MRR             0.814      0.732      +0.082    ✅ PASS
Retrieval           NDCG@5          0.882      0.810      +0.072    ✅ PASS
Latency             p50 (Median)    18.2 ms    22.0 ms    -3.8 ms   ✅ PASS
Latency             p95             42.5 ms    50.7 ms    -8.2 ms   ✅ PASS
--------------------------------------------------------------------------------------------------
Reflection          Precision       0.941      0.833      +0.108    ✅ PASS
Reflection          Recall          0.923      0.800      +0.123    ✅ PASS
Reflection          F1-Score        0.932      0.816      +0.116    ✅ PASS
Reflection          Conflict Res    100.0%     60.0%      +40.0%    ✅ PASS
--------------------------------------------------------------------------------------------------
Compatibility       8/8 MCP Tools   100.0%     100.0%     0.0%      ✅ PASS
Compatibility       5/5 CLI Cmds    100.0%     100.0%     0.0%      ✅ PASS
Database            Zero Data Loss  Verified   Verified   0.0%      ✅ PASS
==================================================================================================
OVERALL STATUS: ✅ ALL BENCHMARK GATES PASSED (Zero Regressions Detected)
==================================================================================================
```

#### C.4. Regression Gates & Invalidation Rules
The runner enforces automated failure (`process.exit(1)`) if any of the following regression thresholds are triggered:
1. $\Delta \text{Recall}@5 < -0.02$ (Any drop $> 2\%$ in top-5 recall).
2. $\Delta \text{MRR} < -0.03$ (Any drop $> 3\%$ in mean reciprocal rank).
3. $\Delta \mathcal{F}_{1,\text{ext}} < -0.03$ (Any drop $> 3\%$ in extraction F1).
4. $\Delta \text{Latency}_{p95} > +20\%$ (Latency regression $> 20\%$ at 95th percentile).
5. Any backward compatibility test failure on existing 8 MCP tools or 5 CLI commands.
6. Any schema mutation that drops or corrupts existing SQLite tables.

---

### Part D: Backward Compatibility Test Specification

#### D.1. MCP Tools Verification Matrix (8 Core Tools)
Transport: JSON-RPC 2.0 stdio stream (`node mcp_server.js`).

| Tool Name | Input Payload | Expected Output / Response Contract | Verification Assertions |
|---|---|---|---|
| `brain_search` | `{"query": "bảo mật", "scope": "all", "limit": 5}` | Valid JSON-RPC result containing markdown summary of knowledge & episodes. | `result.content[0].text` includes `#1` or `Quy chuẩn`; schema matches MCP standard. |
| `brain_store` | `{"title": "Test Title", "content": "Test Body", "category": "note", "tags": "test", "importance": 1.0}` | Confirmation string with generated item ID. | Returned ID $> 0$; record verified in SQLite `knowledge_items`. |
| `brain_profile_get`| `{}` | Formatted list of all profile facts grouped by category. | Output includes `[identity] honorific: Ngài (Sir)` and `[style] language_preference`. |
| `brain_profile_set`| `{"key": "test_mcp_compat", "value": "compat_val", "category": "tech_stack"}` | Success confirmation message. | `SELECT value FROM user_profile WHERE key='test_mcp_compat'` equals `'compat_val'`. |
| `brain_conversation_history` | `{"query": "antigravity", "limit": 3}` | Formatted conversation session list. | Does not crash; returns array of session headers. |
| `brain_stats` | `{}` | Detailed statistical report string. | Output contains `Tri thức dài hạn`, `User Profile`, `384-dim`. |
| `brain_git_backup` | `{"message": "automated test backup"}` | JSON or text diff commit report. | Returns `success: true` or clean git status without unhandled exceptions. |
| `brain_git_status` | `{}` | Git status report string. | Returns branch name, latest commit, or clean initialized status. |

*Extended MCP Tools also covered in regression test:* `brain_delete`, `brain_solution_search`, `brain_solution_store`.

#### D.2. CLI Commands Verification Matrix (5 Core Commands)
Execution: `node cli.js <command>` (or `agy-node cli.js <command>`).

| Command | Invocations Tested | Expected Exit Code | Expected Stdout Signatures |
|---|---|---|---|
| `sync` | `node cli.js sync` | 0 | `Đang đồng bộ hóa`, `Đồng bộ hoàn tất!`, `Phiên trò chuyện được xử lý` |
| `search` | `node cli.js search "bảo mật token"` | 0 | `Kết quả tìm kiếm cho: "bảo mật token"`, `Tri thức & Ghi chú` |
| `profile` | `node cli.js profile` | 0 | `HỒ SƠ CỐT LÕI CỦA NGÀI`, `Ngài (Sir)`, `Hoàng Mai, Hà Nội` |
| `stats` | `node cli.js stats` | 0 | `BÁO CÁO THỐNG KÊ`, `Tri thức dài hạn`, `Hồ sơ người dùng`, `brain.db` |
| `git-backup` | `node cli.js git-backup "eval test"` | 0 | `Đang tiến hành sao lưu`, `Hồ sơ cá nhân`, `Tri thức`, `Giải pháp lỗi` |

*Extended CLI Commands also verified:* `node cli.js solutions`, `node cli.js solution "port 3000"`, `node cli.js store "test" "body"`, `node cli.js compact`, `node cli.js backup`, `node cli.js backups`.

#### D.3. Database Integrity & Zero-Breakage Verification Protocol
1. **Checksum & Row Count Verification:**
   Before and after any core engine optimization:
   $$\Delta \text{Count}(\text{user\_profile}) \ge 0, \quad \Delta \text{Count}(\text{knowledge\_items}) \ge 0, \quad \Delta \text{Count}(\text{episodes}) \ge 0$$
   No existing rows modified or deleted without explicit user intent.
2. **Schema Non-Destructive Invariance:**
   - Existing tables (`user_profile`, `session_state`, `conversations`, `episodes`, `knowledge_items`, `solutions`, `entities`, `entity_relations`) and FTS5 tables (`knowledge_fts`, `episodes_fts`, `solutions_fts`) must maintain all existing columns and data types.
   - Any schema expansion (e.g. Graph edge properties or memory decay metadata) must be purely additive (`ALTER TABLE ... ADD COLUMN` or `CREATE TABLE IF NOT EXISTS`).
3. **Database Concurrency & Pragmas:**
   - WAL journal mode (`PRAGMA journal_mode = WAL`) must remain enabled.
   - Foreign key integrity (`PRAGMA foreign_keys = ON`) must be satisfied on all operations.

---

## 4. Caveats & Assumptions

1. **Neural Daemon Cold Start vs Warm Cache:**
   - If `src/embedding_daemon.py` is cold, the initial request takes ~800-1200ms to load `fastembed`. Benchmark runs should execute 1 warm-up query before measuring latency percentiles.
2. **Fallback Vector Generator:**
   - If `fastembed` is unavailable on a target machine, `src/embedding.js` falls back to hash vectors. While functional, semantic paraphrase scores will degrade. The eval runner must log the embedding engine state (`daemon` vs `fallback`).
3. **Token Budgeting Compression:**
   - `ContextRetriever` imposes an 800-token ceiling (~3,200 chars). In end-to-end context injection, lower-ranking items may be pruned by the token budget. The retrieval benchmark measures pure rank-level retrieval quality independently of prompt budget truncation.
4. **Synthetic vs Production Privacy:**
   - The ground-truth benchmark datasets must reside in `eval/datasets/` as clean synthetic/anonymized fixtures so that developers and CI systems can test without exposing sensitive personal conversations.

---

## 5. Conclusion & Actionable Next Steps

The evaluation suite design defined herein provides a mathematically rigorous, automated, and reproducible foundation for optimizing the Antigravity Second Brain:
1. Standard IR metrics (Recall@1/3/5/10, MRR, NDCG@5, p50/p95 latency) covering keyword, semantic, relational, and temporal scenarios.
2. Fact extraction metrics (Precision, Recall, F1) benchmarked against representative bilingual dialogues with strict conflict resolution and deduplication checks.
3. Isolated CLI runner (`eval/run_eval.js`) with structured JSON output, ASCII terminal dashboard, and automated CI regression gates against `eval/baselines/v2.0_baseline.json`.
4. Comprehensive 100% backward compatibility test matrix for all 8 MCP tools, 5 CLI commands, and database schema integrity.

---

## 6. Verification Method

To independently verify this specification and its baseline execution:

1. **Inspect and Verify Baseline Unit Tests:**
   ```bash
   node test/test_brain.js
   ```
   *(Note: As observed in Section 1, line 53 requires `await semantic.addItem` to resolve the existing async test defect).*

2. **Verify Existing MCP Tools via Stdio:**
   ```bash
   node test/test_mcp.js
   ```
   Inspect stdout to confirm `initialize`, `tools/list`, and `brain_stats` return valid JSON-RPC responses.

3. **Verify Existing CLI Commands:**
   ```bash
   node cli.js stats
   node cli.js profile
   ```

4. **Verify Prototype Evaluation Runner (Once Implemented):**
   ```bash
   node eval/run_eval.js --suite all --compare-baseline eval/baselines/v2.0_baseline.json
   ```

5. **Invalidation Conditions:**
   - Any test failure in MCP tools or CLI commands.
   - Retrieval Recall@5 falling below 0.85 or MRR below 0.75 on benchmark datasets.
   - Extraction F1 falling below 0.85 on benchmark dialogues.
   - Unhandled SQLite schema migrations causing data corruption or loss in `brain.db`.
