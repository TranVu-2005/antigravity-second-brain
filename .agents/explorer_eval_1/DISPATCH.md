## 2026-09-13T07:08:16Z

You are explorer_eval_1, a Benchmark & Evaluation Explorer for the Second Brain optimization project.
Your working directory is: C:\Users\tvu16\.gemini\antigravity\second_brain\.agents\explorer_eval_1
Project root is: C:\Users\tvu16\.gemini\antigravity\second_brain

MANDATORY FIRST STEP: Read the original user request at:
C:\Users\tvu16\.gemini\antigravity\second_brain\.agents\ORIGINAL_REQUEST.md

Your task:
Research, specify, and design a standardized, automated, and reproducible evaluation suite (Eval Suite) for Second Brain:
1. Retrieval Evaluation Architecture:
   - Formulate standard metrics: Recall@K (K=1, 3, 5, 10), MRR (Mean Reciprocal Rank), NDCG@K, query latency (p50, p95, p99 in ms).
   - Define multi-scenario benchmark queries:
     * Keyword-exact search queries
     * Semantic / paraphrased queries
     * Multi-hop / relational queries
     * Temporal / chronological queries (e.g. "what was worked on yesterday vs last month")
   - Design synthetic/curated ground-truth test datasets with labeled relevant memory IDs.
2. Reflection & Fact Extraction Evaluation:
   - Formulate precision, recall, and F1 score for extracted user facts, preferences, and profile attributes.
   - Design benchmark conversation dialogues with known target profile updates / factual extractions.
   - Define evaluation criteria for accuracy, deduplication, and conflict resolution.
3. Automated Evaluation Runner Architecture:
   - Design CLI entry point (e.g. `python -m second_brain.eval` or `python eval/run_eval.py`).
   - Output format: structured JSON report + human-readable terminal summary table.
   - Regression gates: ability to compare baseline vs new version and fail on metric regression.
4. Backward Compatibility Test Specification:
   - Test matrix for all 8 MCP tools: `brain_search`, `brain_store`, `brain_profile_get`, `brain_profile_set`, `brain_conversation_history`, `brain_stats`, `brain_git_backup`, `brain_git_status`.
   - Test matrix for all 5 CLI commands: `sync`, `search`, `profile`, `stats`, `git-backup`.
   - Integrity verification: zero data loss, zero schema breakages on existing SQLite databases.

Write your evaluation design and test specifications to:
C:\Users\tvu16\.gemini\antigravity\second_brain\.agents\explorer_eval_1\handoff.md
Follow standard Handoff protocol. When complete, send a message back to the orchestrator.
