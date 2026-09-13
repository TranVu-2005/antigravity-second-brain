# Master Plan: Second Brain SOTA Optimization & Eval Suite

## Objective
Fulfill all requirements in ORIGINAL_REQUEST.md:
1. R1: SOTA Memory Architecture Research & Gap Analysis (Mem0, Letta, Zep, LangMem, TiMem).
2. R2: Core Engine Optimization (retrieval accuracy/efficiency, episodic/knowledge indexing, reflection engine).
3. R3: Automated Comprehensive Evaluation Suite (benchmarks Recall@K, MRR, latency, reflection accuracy).
4. R4: 100% Backward Compatibility for MCP tools and CLI commands with zero regression.

## Phase Breakdown
### Phase 0: Survey & Codebase Exploration (Parallel)
- Dispatch 3 parallel Explorers:
  - `explorer_codebase`: Map current Second Brain architecture, index files, schemas, SQLite/vector DB, retrieval pipeline, reflection engine, MCP server, and CLI tools.
  - `explorer_sota`: Deep research on SOTA memory architectures (Mem0, Letta, Zep, LangMem, TiMem) via web & academic literature.
  - `explorer_eval`: Benchmark design (Recall@K, MRR, latency, precision/recall on profile/fact extraction) and evaluation runner architecture.
- Aggregate survey reports into `PROJECT.md` Feature Inventory & Architecture.

### Phase 1: Milestone R1 — Research & Gap Analysis Document
- Worker synthesizes comprehensive SOTA memory architecture analysis document into `docs/sota_memory_architecture_research.md` covering Mem0, Letta, Zep, LangMem, TiMem, trade-offs, and gap analysis against Second Brain.
- Reviewer & Critic verify accuracy, depth, and actionable insights.

### Phase 2: Milestone R3 — Automated Evaluation Suite
- Dual Track: Develop evaluation runner CLI (`python -m second_brain.eval` or equivalent script).
- Implement standard benchmark datasets and metrics:
  - Retrieval: Multi-hop, keyword, semantic queries with Recall@K, MRR, latency.
  - Reflection: Dialogue-to-profile/fact extraction accuracy (Precision, Recall, F1).
- Establish baseline benchmark scores before code changes.

### Phase 3: Milestone R2 — Core Engine Optimization
- Implement optimizations:
  - Hybrid search enhancements (combining BM25/FTS5 + dense embedding + temporal decay / importance scoring).
  - Episodic & knowledge indexing pipeline optimizations.
  - Reflection extraction engine refinements for higher fidelity fact/preference capture.
- Run baseline vs post-optimization eval comparison to prove measurable improvement.

### Phase 4: Milestone R4 — Backward Compatibility & Verification
- Verify all MCP tools (`brain_search`, `brain_store`, `brain_profile_get`, `brain_profile_set`, `brain_conversation_history`, `brain_stats`, `brain_git_backup`, `brain_git_status`).
- Verify all CLI commands (`sync`, `search`, `profile`, `stats`, `git-backup`).
- Ensure zero data loss / corruption on existing memories.

### Phase 5: Gating, Review, Audit & Sentinel Handoff
- Independent Reviewers, Challengers (stress testing), and Forensic Auditor.
- Complete `GATE_STATUS.md` and send completion report to caller/sentinel.
