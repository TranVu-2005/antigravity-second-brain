# Project: Antigravity Second Brain SOTA Optimization & Evaluation Suite

## Architecture
- **Runtime & Persistence**: Node 24 native `node:sqlite` (`DatabaseSync`) in WAL mode (`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`). Zero npm external dependencies.
- **Embedding Subsystem**: Local Python micro-daemon (`fastembed` 0.8.0, `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, 384 dimensions) on `http://127.0.0.1:49152` with LRU in-memory cache and Murmur hash vector fallback.
- **Multi-Tier Memory Topology**:
  - **Tier 0 (Core Persona/Profile)**: `user_profile` table (identity, style, tech stack, environment, principles, location).
  - **Tier 1 (Entity Knowledge Graph)**: `entities` and `entity_relations` tables, navigable via SQLite recursive Common Table Expressions (CTEs).
  - **Tier 2 (Episodic History)**: `conversations` and `episodes` tables with SQLite FTS5 BM25 token index (`episodes_fts`).
  - **Tier 3 (Semantic Knowledge)**: `knowledge_items` table with FTS5 (`knowledge_fts`) and dense 384-dim Float32Array vector blobs.
  - **Tier 4 (Procedural Solutions)**: `solutions` table with FTS5 index (`solutions_fts`) for error-to-fix patterns.
- **Retrieval & Fusion Engine**:
  - Candidate pre-filtering to eliminate unindexed $O(N)$ vector loops.
  - Reciprocal Rank Fusion (RRF) combining dense cosine similarity, FTS5 BM25 ranks, and active temporal recency ($1 / (1 + \text{ageHours} / 168.0)$).
- **Reflection & Extraction Engine**:
  - Multi-lingual extraction pipeline with regex fast-path and structured action triage (`ADD`, `UPDATE`, `DELETE`, `NOOP`).
  - Deduplication and dynamic conflict resolution (superseding outdated location/preference facts without ghost duplicates).
- **Evaluation & Benchmarking Harness**:
  - Isolated runner (`eval/run_eval.js`) running against synthetic SQLite fixture sandbox (`eval_temp_brain.db`).
  - Standard IR metrics: Recall@K ($K \in \{1, 3, 5, 10\}$), MRR, NDCG@5, Latency percentiles (p50, p95, p99 ms).
  - Reflection metrics: Precision, Recall, F1 score across Profile, Rule, and Procedural categories.
  - Regression gate comparing new metrics against gold baseline (`eval/baselines/v2.0_baseline.json`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | SOTA Architecture Research Document | Publish comprehensive analysis of Mem0, Letta, Zep, LangMem, and TiMem with trade-offs and Second Brain gap analysis | M1 | ORIGINAL_REQUEST §R1 |
| F02 | Evaluation Datasets & Fixtures | Standardized ground-truth datasets for 15+ retrieval queries (KW, SEM, MH, TMP) and 5 reflection dialogues | M2 | ORIGINAL_REQUEST §R3 |
| F03 | Automated Evaluation Runner | CLI runner `node eval/run_eval.js` producing structured JSON report and Unicode terminal dashboard | M2 | ORIGINAL_REQUEST §R3 |
| F04 | Baseline Metric Establishment | Run initial evaluation to establish gold baseline metrics for regression comparison | M2 | ORIGINAL_REQUEST §R3 |
| F05 | Test Suite Remediation | Fix un-awaited async calls in `test/test_brain.js` and align assertions with retriever output | M3 | Survey Findings |
| F06 | Entity Graph Bug Fix & Activation | Fix column mismatch in `entity_relations` (`source_entity` vs `source`) and implement graph traversal | M3 | Survey Findings |
| F07 | Hybrid Search RRF & Active Recency | Implement Reciprocal Rank Fusion, candidate pre-filtering, and incorporate active recency decay into scoring | M3 | ORIGINAL_REQUEST §R2 |
| F08 | Multilingual Reflection & Conflict Resolution | Upgrade `src/extractor.js` with structured action triage (ADD/UPDATE/DELETE), conflict resolution and bilingual support | M3 | ORIGINAL_REQUEST §R2 |
| F09 | Memory Consolidation & Decay Tuning | Calibrate Ebbinghaus decay curve, category-specific half-lives, and spaced repetition stability | M3 | ORIGINAL_REQUEST §R2 |
| F10 | MCP Tool 100% Backward Compatibility | Verify all 8 core MCP tools + 3 extended tools adhere strictly to existing JSON-RPC schemas | M4 | ORIGINAL_REQUEST §R4 |
| F11 | CLI Command 100% Backward Compatibility | Verify all 5 core CLI commands + 11 extended commands execute cleanly without error | M4 | ORIGINAL_REQUEST §R4 |
| F12 | Zero Data Loss & Schema Invariance | Verify all 1,193 episodes, 12 profile items, 15 solutions, 11 knowledge items remain intact in `brain.db` | M4 | ORIGINAL_REQUEST §R4 |
| F13 | Post-Optimization Eval & Regression Gate | Re-run automated evaluation suite, verify zero regression, and confirm measurable retrieval & reflection gains | M4 | ORIGINAL_REQUEST §R3, §R4 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | SOTA Memory Architecture Research Document | Generate `docs/sota_memory_architecture_research.md` detailing Mem0, Letta, Zep, LangMem, TiMem, architectural trade-offs, and Second Brain gap analysis | None | DONE |
| M2 | Automated Evaluation Suite & Benchmark Runner | Implement `eval/run_eval.js`, metrics library, benchmark datasets (`eval/datasets/`), and establish initial baseline | None | DONE |
| M3 | Second Brain Core Engine Optimization | Remediate bugs (`test/test_brain.js`, `entity_relations`), implement RRF hybrid search + recency, candidate pre-filter, and reflection engine upgrade | M2 | DONE |
| M4 | Compatibility, Regression Verification & Final Gate | Verify all 11 MCP tools, 16 CLI commands, verify zero data loss, execute evaluation regression gate, and finalize project | M1, M3 | IN_PROGRESS |

---

## Interface Contracts

### M2: Evaluation Suite Runner CLI Contract
- Command: `node eval/run_eval.js [options]`
- Options:
  - `--suite <all|retrieval|reflection|compat>` (default: `all`)
  - `--compare-baseline <path>` (optional baseline JSON for regression checking)
  - `--threshold <float>` (allowable regression threshold, default: 0.02)
  - `--output <path>` (path to write output JSON report)
- Exit codes:
  - `0`: All evaluated suites passed and regression gates satisfied.
  - `1`: Assertion failure, regression detected, or test crash.

### M3: Hybrid Search API Contract (`src/semantic.js`)
- Method: `async searchKnowledge(query, limit = 5, category = null)`
- Return type: `Promise<Array<{ id, title, content, category, tags, score, denseScore, sparseScore, recencyScore }>>`
- Behavior:
  - Returns top results ordered descending by fused RRF/hybrid score.
  - Tolerates daemon downtime via graceful fallback vector generation.
  - Does not mutate underlying records during read operations.

### M3: Reflection Extractor Contract (`src/extractor.js`)
- Method: `extractFromTurn(userText, assistantText, context = {})`
- Return type: `{ profiles: Array<{ key, value, category, action: 'ADD'|'UPDATE'|'DELETE' }>, knowledge: Array<{ title, content, category, tags, importance }>, solutions: Array<{ error_pattern, root_cause, solution_code, command_fix, project_scope }> }`
- Behavior:
  - Pure function; parses input text without unhandled exceptions.
  - Rejects conversational chatter without false-positive extractions.

### M4: MCP Server JSON-RPC Contract (`mcp_server.js`)
- Protocol: JSON-RPC 2.0 over standard I/O (`process.stdin`, `process.stdout`).
- Preserved Core Tools: `brain_search`, `brain_store`, `brain_profile_get`, `brain_profile_set`, `brain_conversation_history`, `brain_stats`, `brain_git_backup`, `brain_git_status`.
- Schema invariant: Input argument names, types, and return object envelopes (`content[0].text`) remain 100% backward compatible.

### M4: CLI Commands Contract (`cli.js`)
- Commands: `sync`, `search <query>`, `profile`, `stats`, `git-backup [msg]`.
- Exit code 0 on successful execution; formatted human-readable output to stdout.

---

## Code Layout
- Documentation:
  - `docs/sota_memory_architecture_research.md` (Owned by M1 Worker)
- Evaluation Harness:
  - `eval/run_eval.js` (Owned by M2 Worker)
  - `eval/lib/metrics.js` (Owned by M2 Worker)
  - `eval/lib/test_environment.js` (Owned by M2 Worker)
  - `eval/lib/retrieval_evaluator.js` (Owned by M2 Worker)
  - `eval/lib/reflection_evaluator.js` (Owned by M2 Worker)
  - `eval/lib/reporter.js` (Owned by M2 Worker)
  - `eval/datasets/retrieval_benchmark.json` (Owned by M2 Worker)
  - `eval/datasets/reflection_benchmark.json` (Owned by M2 Worker)
  - `eval/datasets/seed_database.sql` (Owned by M2 Worker)
  - `eval/baselines/v2.0_baseline.json` (Owned by M2 Worker)
- Core Engine Modifications:
  - `src/semantic.js` (Owned by M3 Worker)
  - `src/retriever.js` (Owned by M3 Worker)
  - `src/extractor.js` (Owned by M3 Worker)
  - `src/consolidation.js` (Owned by M3 Worker)
  - `test/test_brain.js` (Owned by M3 Worker)
- System Interfaces (Verification Only, No Breaking Changes):
  - `mcp_server.js` (Verified by M4 Worker/Reviewers)
  - `cli.js` (Verified by M4 Worker/Reviewers)
  - `brain.db` (Read-only for tests; verified zero data loss)
