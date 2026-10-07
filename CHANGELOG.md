# Antigravity Second Brain — Changelog & Migration Guide

All notable changes to the **Antigravity Second Brain** engine are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) standards.

---

## [3.8.1] - 2026-10-07

### Production-Grade Invariants Verification, Trust & Scope Isolation, Cascade Deletion & Graph Multi-Hop

This release formalizes the production-grade quality gate based on independent architectural audits, resolving all P1 correctness and durability invariants:

#### Added & Improved
- **Trust Metadata Persistence (`TRUST-001`):**
  - Fully preserved `trust_level`, `confidence`, `verification_status`, and `last_verified_at` across `knowledge.json`, `solutions.json`, and `dump.sql` export and import cycles.
  - Ensured data recovered via `pullRemote()` or `importDump()` retains its verified standing without silently degrading to defaults.
- **Trust-Aware Reciprocal Rank Fusion (`TRUST-002`):**
  - Modulated candidate scores using trust weights and applied a `+0.15` rank boost for verified and stable items (`verified`/`stable`).
  - Prevented candidate or unverified extractions from outranking established rules and architectural decisions under equivalent lexical/semantic relevance.
- **Workspace Project Scope Isolation (`SCOPE-001`):**
  - Added strict `project_scope` filtering across empty, FTS sparse, and hybrid dense search pathways.
  - Guaranteed absolute memory isolation between independent workspaces, preventing cross-project context pollution while permitting `global` rules.
- **Cascading Memory Deletion (`FORGET-001`):**
  - Added `deleteSolution()` in `src/solutions.js` and updated `deleteItem()` in `src/semantic.js` with FTS5 virtual table synchronization.
  - Upgraded the `brain_forget` MCP tool to cascade deletions across `user_profile`, `knowledge_items`, and `solutions`.
- **Fallback Vector Tagging & Autonomous Healing (`EMBED-001`, `EMBED-002`):**
  - Introduced `embedding_status` (`neural` | `fallback`) to `knowledge_items` with non-destructive schema migrations.
  - Tagged items created while the daemon is offline as `fallback`, and autonomously re-embedded them to `neural` via `_backfillEmbeddings()` once the FastEmbed service recovers.
- **Atomic Transactional Restore & Synchronous Failure Propagation (`RESTORE-001`, `SYNC-001`):**
  - Standardized `setup.js` to route through atomic `GitBackupManager.importDump()` (`BEGIN IMMEDIATE` -> `PRAGMA integrity_check` -> `COMMIT`).
  - Ensured `pullRemote()` validates import results and returns `success: false` with detailed error traces if dump integrity checks fail.
- **Multi-Hop Graph Candidate Expansion Without Lexical Overlap (`GRAPH-001`):**
  - Enhanced 2-hop recursive entity graph traversal in `src/retriever.js` to boost scores for multi-hop connected candidates.
  - Enabled the agent to surface connected architecture and topology rules even when user prompts share zero keywords with the target items.
- **MCP Protocol Negotiation & 14-Tool Formal Verification (`MCP-001`, `MCP-002`):**
  - Synchronized version `3.8.1` across `package.json`, `mcp_server.js`, and `brain_stats`.
  - Added multi-version protocol negotiation (`2024-11-05`, `2025-03-20`, `2026-07-28`).
  - Rewrote `test/test_mcp.js` with comprehensive JSON-RPC 2.0 schema assertions across all 14 MCP tools.
- **Empirical Regression Benchmarks (`EVAL-001`, `EVAL-002`):**
  - Executed evaluation on HEAD: Recall@10 at `0.892`, MRR at `0.502`, NDCG@5 at `0.466`, p50 latency at `5.5ms`.
  - Verified zero regressions against the v3.8 baseline across 100% of benchmark gates.

---

## [3.8.0] - 2026-10-06

### GitHub Actions CI Activation, Atomic Transactional Restore, Memory Trust Lifecycle & Multi-Hop Retrieval

#### Added & Improved
- **Live GitHub Actions CI/CD:**
  - Standardized `.github/workflows/ci.yml` with a 4-environment test matrix: Ubuntu (Node 22, 24) and Windows (Node 22, 24).
  - Configured secure SSH credential deployment for isolated GitHub runner execution.
- **Atomic Transactional Restore (`importDump`):**
  - Wrapped SQLite dump import into isolated `BEGIN IMMEDIATE` transactions with automatic `ROLLBACK` on parse or constraint failure.
  - Integrated `PRAGMA integrity_check` before committing.
- **Memory Trust Boundary & Confidence Lifecycle:**
  - Added trust fields to `knowledge_items` and `solutions` (`trust_level`, `confidence`, `verification_status`, `last_verified_at`).
  - User directives receive immediate `high` / `verified` trust, while automated extractions begin as `candidate` pending consolidation.
- **Master Test Runner Auto-Discovery:**
  - Updated `test/run_all_tests.js` to dynamically discover and run all suites across the repository.
- **Empirical Evaluation Pipeline:**
  - Automated version-labeled benchmark reports in `eval/run_eval.js` with regression comparison flags.

---

## [3.7.0] - 2026-10-06

### Security Hardening, Bi-Temporal Graph, Complete Data Recovery & CI/CD Discovery

#### Security & Architecture
- **Eliminated Command Injection (P0 Security):**
  - Replaced all shell concatenation `execSync` with array-based `spawnSync` in `src/git_backup.js` and `cli.js`, preventing metacharacter execution.
  - Enforced strict URL format validation before updating Git remotes.
- **Staging Allowlist & Pre-Commit Secret Scanner (P0/P1):**
  - Replaced blanket `git add .` with an explicit `ALLOWED_EXPORT_FILES` allowlist.
  - Integrated pre-commit secret scanning for private keys, GitHub tokens, and cloud provider API keys.
  - Isolated the binary `brain.db` database containing raw interaction history from public Git tracking.
- **Bi-Temporal Graph Preservation ($A \to B \to C \to A$):**
  - Replaced table-level unique constraints with partial unique index `idx_relations_active` (`WHERE valid_until IS NULL`).
  - Preserved full historical timelines when relationships cycle back to prior states.
- **Observability & Throttling:**
  - Introduced `getEmbeddingHealth()` for transparent service state reporting (`READY`, `DEGRADED`, `UNAVAILABLE`).
  - Enforced 30-minute throttling on auto-commits in `hooks/stop.js`.

---

## [3.6.0] - 2026-10-05

### Universal Dual-Boot Parity, Full Superpowers Suite & 1-Click Linux Deploy

#### Added & Improved
- **Superpowers Cognitive Suite Integration:**
  - Bundled 24 cognitive skills under `integrations/skills/`.
  - Added automated skill and global prompt synchronization in `_bundleIntegrations()`.
- **1-Click Universal Deployment (`setup.js` & `install.sh`):**
  - Added OS-aware bootstrapping for Windows 11 and Linux (Ubuntu, Debian, Fedora, Arch, WSL2).
  - Automated directory initialization, skill symlinks, and database restoration.
- **Linux Dual-Boot Parity:**
  - Configured executable permissions (`chmod 755`) for all engine scripts.
  - Added POSIX system utilities (`temp`, `screenoff`, `agy-brain`) under `~/.local/bin/`.
  - Switched remote sync to `git pull --rebase origin main` to prevent merge commits across environments.

---

## [3.5.0] - 2026-10-04

### Zero-Crash Parameter Sanitization, Batch Transaction Ingestion & Isolated TDD Fortress

#### Added & Improved
- **Parameter Sanitization:**
  - Introduced `_sanitizeParams()` in `src/db.js` to convert `undefined` values to `null`, ensuring strict compatibility with Node 24 `node:sqlite`.
- **Batch Transaction Ingestion:**
  - Refactored `ingestTranscriptFile()` in `src/episodic.js` into atomic SQLite transactions, accelerating multi-step ingestion by up to 100x.
- **Synchronous Lifecycle Decoupling:**
  - Removed heavy session distillation from `PreInvocation` hook, reducing hook latency to under 15ms.
- **Isolated In-Memory TDD Suite:**
  - Added `createTestDB(':memory:')` in `src/db.js` for isolated testing without modifying production databases.

---

## [3.4.0] - 2026-09-27

### Zero-Lag Sync, PostInvocation Hook, Autonomous Promotion & Natural Language Extractor

#### Added & Improved
- **PostInvocation Lifecycle Hook (`hooks/post_invocation.js`):**
  - Added incremental turn ingestion immediately after agent responses.
- **Autonomous Knowledge Promotion:**
  - Added `_autoPromoteInsights()` in `src/consolidation.js` to distill architectural decisions and learned fixes into searchable knowledge cards.
- **Natural Language Extraction Heuristics:**
  - Expanded heuristic pattern recognition for unstructured architectural choices and bug fixes.
- **Working Memory Continuation:**
  - Enabled cross-session goal resolution for continuation queries.

---

## [3.0.0] - 2026-09-17

### Bi-Temporal Graph, Active Self-Editing Memory & Executive Session Distillation

#### Added & Improved
- **Dynamic Relevance Cutoff:**
  - Implemented token-saving cutoff for casual greetings, reducing injected prompt size by up to 65%.
- **Bi-Temporal Knowledge Graph:**
  - Added `valid_from` and `valid_until` tracking with sub-millisecond SQLite Recursive CTE traversal (`< 1.5ms`).
- **Active Self-Editing Memory Tools:**
  - Introduced 3 active MCP tools: `brain_remember`, `brain_forget`, and `brain_learn_fix` (bringing total tools to 14).
- **Executive Session Distillation:**
  - Structured transcript summarization into 4 core pillars: Goal, Decisions, Files, and Lessons Learned.

---

## [2.0.0] - 2026-09-13

### RRF Hybrid Search, Automated Evaluation Suite & Hardened Reflection Engine

#### Added & Improved
- **Hybrid Search Engine:**
  - Fused dense vector cosine similarity, FTS5 BM25, and temporal recency decay via Reciprocal Rank Fusion ($k=60$).
- **Automated Evaluation Suite:**
  - Added `eval/run_eval.js` supporting Recall@K, MRR, NDCG@5, and latency percentile tracking.
- **Adversarial Hardening:**
  - Strengthened prompt injection filtering, chatter suppression, and retraction handling in `src/extractor.js`.

---

## [1.0.0] - 2026-09-11

### Initial Cognitive Architecture Foundation

- Initial release with 5-tier memory hierarchy (Profile, Working State, Episodic, Semantic, Procedural).
- Integrated lifecycle hooks (`pre_invocation.js`, `stop.js`) and Model Context Protocol (MCP) server.
- Built on Node.js native standard library with zero runtime npm dependencies.
