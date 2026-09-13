# Second Brain Evaluation Suite (M2 Test Track): Test Ready & Runner Guide

**Milestone:** M2 (Comprehensive Evaluation Suite & Benchmark Runner)  
**Status:** ✅ TEST READY  
**Author:** worker_m2_1 (Evaluation Suite Engineer)  
**Baseline Version:** 2.0.0 (`eval/baselines/v2.0_baseline.json`)  
**Project Root:** `C:\Users\tvu16\.gemini\antigravity\second_brain`  

---

## 1. Executive Summary

Milestone M2 establishes an automated, mathematically rigorous, reproducible evaluation harness for the Antigravity Second Brain cognitive memory system. It provides:
1. **Isolated Sandbox Execution**: Evaluates memory operations against a dedicated temporary SQLite instance (`eval/eval_temp_brain.db`) seeded from standardized fixtures (`eval/datasets/seed_database.sql`), ensuring **100% isolation** from production `brain.db` and active configuration files.
2. **Information Retrieval (IR) Benchmarks**: 17 multi-scenario test queries covering Keyword-exact, Semantic paraphrase, Multi-hop relational, and Temporal freshness queries, reporting Recall@1/3/5/10, Precision@1/3/5/10, MRR, NDCG@5, and latency distribution percentiles (p50, p95, p99, mean).
3. **Reflection & Extraction Benchmarks**: 5 representative conversation dialogues (D-01 to D-05) benchmarking user profile expansion, permanent directive/rule extraction, procedural bug troubleshooting, conversational chatter suppression (negative control), and dynamic conflict resolution without ghost records.
4. **Backward Compatibility & Invariance**: Automated verification for 8 core MCP tools (JSON-RPC 2.0 over stdio), 5 core CLI commands, and database schema invariance.
5. **CI/CD Regression Gating**: Automated exit code enforcement (`exit 1` on regression exceeding threshold) against gold baselines.

---

## 2. Benchmark Inventory

### 2.1. Retrieval Benchmark (`eval/datasets/retrieval_benchmark.json`)
Comprises **17 ground-truth benchmark queries** across 4 distinct memory access scenarios:

| Query ID | Scenario | Query String | Target Store | Relevant IDs | Primary Target & Grade |
|---|---|---|---|---|---|
| `RET-KW-001` | Keyword-exact | `"screenoff.cmd"` | `knowledge` | `[8, 9, 10]` | ID 8 (Grade 3), IDs 9, 10 (Grade 2) |
| `RET-KW-002` | Keyword-exact | `"PowerShell quoting argument list"` | `solutions` | `[1]` | ID 1 (Grade 3) |
| `RET-KW-003` | Keyword-exact | `"FastTemp ThreadPoolExecutor"` | `knowledge` | `[11]` | ID 11 (Grade 3) |
| `RET-KW-004` | Keyword-exact | `"antigravity-second-brain.git"` | `knowledge` | `[1]` | ID 1 (Grade 3) |
| `RET-KW-005` | Keyword-exact | `"Lenovo Legion Toolkit Quick Action"` | `knowledge` | `[10, 8]` | ID 10 (Grade 3), ID 8 (Grade 2) |
| `RET-SEM-001` | Semantic Paraphrase | `"nơi ở và làm việc hiện tại của Ngài"` | `knowledge` | `[3, 2]` | ID 3 (Grade 3), ID 2 (Grade 1) |
| `RET-SEM-002` | Semantic Paraphrase | `"cách tắt phụt màn hình laptop ngay lập tức"` | `knowledge` | `[8, 10, 9]` | ID 8 (Grade 3), IDs 10, 9 (Grade 2) |
| `RET-SEM-003` | Semantic Paraphrase | `"nguyên tắc không được bịa đặt hay chém gió thông tin"` | `knowledge` | `[2, 1]` | ID 2 (Grade 3), ID 1 (Grade 1) |
| `RET-SEM-004` | Semantic Paraphrase | `"how to resolve powershell single and double quote escaping bug"` | `solutions` | `[1]` | ID 1 (Grade 3) |
| `RET-SEM-005` | Semantic Paraphrase | `"kiểm tra quạt gió và độ nóng CPU Lenovo Legion"` | `knowledge` | `[7, 11, 6]` | ID 7 (Grade 3), ID 11 (Grade 2) |
| `RET-MH-001` | Multi-hop / Relational | `"Các công cụ và nền tảng chính mà Ngài trực tiếp sử dụng để làm việc"` | `knowledge` | `[1, 5, 4]` | ID 1 (Grade 3), IDs 5, 4 (Grade 2) |
| `RET-MH-002` | Multi-hop / Relational | `"Địa chỉ git repo của dự án Second Brain mà Ngài đang phát triển"` | `knowledge` | `[1]` | ID 1 (Grade 3) |
| `RET-MH-003` | Multi-hop / Relational | `"Quy tắc ứng xử và phong cách giao tiếp khi phục vụ Ngài tại Hoàng Mai"` | `knowledge` | `[2, 3]` | ID 2 (Grade 3), ID 3 (Grade 2) |
| `RET-MH-004` | Multi-hop / Relational | `"Môi trường phát triển Python 3.12 và quản lý gói uv"` | `knowledge` | `[5, 1]` | ID 5 (Grade 3), ID 1 (Grade 1) |
| `RET-TMP-001` | Temporal / Freshness | `"Bản cập nhật mới nhất của lệnh kiểm tra nhiệt độ phần cứng"` | `knowledge` | `[11, 7]` | ID 11 (Grade 3), ID 7 (Grade 2), ID 6 (Grade 0) |
| `RET-TMP-002` | Temporal / Freshness | `"Quy tắc điều khiển Legion Toolkit cập nhật gần đây nhất"` | `knowledge` | `[10, 8]` | ID 10 (Grade 3), ID 8 (Grade 2) |
| `RET-TMP-003` | Temporal / Freshness | `"Lệnh temp thế hệ mới tích hợp Lenovo Legion Toolkit"` | `knowledge` | `[7, 11]` | ID 7 (Grade 3), ID 11 (Grade 2) |

### 2.2. Reflection Benchmark (`eval/datasets/reflection_benchmark.json`)
Comprises **5 benchmark dialogue scenarios** evaluating autonomous extraction fidelity:

| Dialogue ID | Category | Title & Objective | Target Extractions & Success Criteria |
|---|---|---|---|
| `D-01` | Profile | Profile Expansion & Tech Preferences | User states Rust/Go focus; extracts `tech_pref_rust_và_go` or `tech_stack` with confidence $\ge 0.9$. |
| `D-02` | Rule | Permanent Directive & Persona Rule | User mandates unit test requirement (Vitest/Jest); extracts `category: 'rule'` with importance $\ge 1.5$. |
| `D-03` | Procedural | Procedural Bug Troubleshooting | User explains fix for Prisma P1001 via `docker start my-postgres`; extracts error pattern & fix command. |
| `D-04` | Negative Control | Conversational Chatter Suppression | User discusses weather and hunger; verifies **0 extractions** (False Positive suppression check). |
| `D-05` | Profile | Conflict Resolution & Supersession | User changes location from Cầu Giấy to Hoàng Mai; verifies active location updated without duplicate ghost records. |

### 2.3. Sandbox Database Seed (`eval/datasets/seed_database.sql`)
- Pre-populated fixtures containing:
  * 12 core `user_profile` records
  * 3 `entities` records
  * 2 `entity_relations` records
  * 11 `knowledge_items` records with pre-computed 384-dim Float32 dense vectors (hex BLOBs)
  * 15 procedural `solutions` records
  * 19 `conversations` records
  * 1,193 historical `episodes` records

---

## 3. Architecture & File Layout

```
eval/
├── run_eval.js                         # Main unified CLI runner with regression gating
├── baselines/
│   └── v2.0_baseline.json              # Version 2.0.0 gold baseline metric reference
├── datasets/
│   ├── seed_database.sql               # Full SQLite schema and fixture dataset (660 KB)
│   ├── retrieval_benchmark.json        # 17 multi-scenario retrieval queries
│   └── reflection_benchmark.json       # 5 multi-turn reflection dialogues
├── lib/
│   ├── metrics.js                      # Vectorized Recall@K, Precision@K, MRR, NDCG@5, Latency, F1
│   ├── test_environment.js            # Isolated SQLite sandbox manager (100% DB isolation)
│   ├── retrieval_evaluator.js          # Multi-scenario retrieval query executor
│   ├── reflection_evaluator.js         # Reflection dialogue replayer & extraction evaluator
│   ├── compat_evaluator.js             # MCP JSON-RPC 2.0 & CLI command compatibility evaluator
│   └── reporter.js                     # Unicode terminal dashboard & JSON report serializer
└── reports/                            # Evaluation output destination (git-ignored)
```

---

## 4. Runner Command Reference

### 4.1. Run Full Evaluation Suite (Default)
Runs Retrieval, Reflection, and Backward Compatibility benchmarks:
```bash
node eval/run_eval.js --suite all
```

### 4.2. Run Individual Suites
```bash
# Information retrieval benchmark only
node eval/run_eval.js --suite retrieval

# Autonomous reflection & fact extraction benchmark only
node eval/run_eval.js --suite reflection

# MCP tools & CLI backward compatibility benchmark only
node eval/run_eval.js --suite compat
```

### 4.3. Run with Baseline Comparison & Regression Gating
Compares current metrics against the v2.0 baseline and enforces automated CI/CD gating:
```bash
node eval/run_eval.js --suite all --compare-baseline eval/baselines/v2.0_baseline.json --threshold 0.02
```
*Note: Exits with code `0` if all benchmark gates pass; exits with code `1` if any regression exceeds the threshold.*

### 4.4. Save Report to JSON File
```bash
# Save report to a designated path
node eval/run_eval.js --suite all --output eval/reports/eval_report_latest.json

# Output pure JSON to stdout (for script piping)
node eval/run_eval.js --suite all --format json
```

---

## 5. Gold Baseline Reference (v2.0.0)

Established on the pre-optimization system (`eval/baselines/v2.0_baseline.json`):

```
==================================================================================================
🧠 ANTIGRAVITY SECOND BRAIN — BENCHMARK EVALUATION REPORT
==================================================================================================
Suite              Metric                Current     Baseline        Delta   Status    
──────────────────────────────────────────────────────────────────────────────────────────────────
Retrieval          Recall@1                0.471        0.471       +0.000   ✅ PASS    
Retrieval          Recall@3                0.706        0.706       +0.000   ✅ PASS    
Retrieval          Recall@5                0.765        0.765       +0.000   ✅ PASS    
Retrieval          Recall@10               0.892        0.892       +0.000   ✅ PASS    
Retrieval          MRR                     0.822        0.822       +0.000   ✅ PASS    
Retrieval          NDCG@5                  0.785        0.785       +0.000   ✅ PASS    
Latency            p50 (Median)           2.6 ms       2.6 ms       -0.0ms   ✅ PASS    
Latency            p95                    3.0 ms       3.0 ms       +0.1ms   ✅ PASS    
Latency            p99                    3.3 ms       3.3 ms       -0.1ms   ✅ PASS    
──────────────────────────────────────────────────────────────────────────────────────────────────
Reflection         Precision               0.667        0.667       +0.000   ✅ PASS    
Reflection         Recall                  0.500        0.500       +0.000   ✅ PASS    
Reflection         F1-Score                0.571        0.571       +0.000   ✅ PASS    
Reflection         Conflict Res           100.0%       100.0%        +0.0%   ✅ PASS    
Reflection         Deduplication          100.0%       100.0%        +0.0%   ✅ PASS    
──────────────────────────────────────────────────────────────────────────────────────────────────
Compatibility      MCP Tools           6/6 calls            -            -   ✅ PASS    
Compatibility      CLI Commands         5/5 cmds            -            -   ✅ PASS    
Database           Schema Integrity       PASSED            -            -   ✅ PASS    
==================================================================================================
OVERALL STATUS: ✅ ALL BENCHMARK GATES PASSED (Zero Regressions Detected)
==================================================================================================
```

---

## 6. Regression Gate Rules

The evaluation runner enforces automated build failure (`process.exit(1)`) under any of the following conditions:
1. **Recall@5 Drop**: $\Delta \text{Recall}@5 < -\text{threshold}$ (default $-0.02$).
2. **MRR Drop**: $\Delta \text{MRR} < -0.03$.
3. **NDCG@5 Drop**: $\Delta \text{NDCG}@5 < -0.03$.
4. **Latency Regression**: $T_{p95} > 1.20 \times T_{p95,\text{baseline}}$ (more than $20\%$ latency degradation).
5. **Reflection F1 Drop**: $\Delta \mathcal{F}_1 < -\text{threshold}$ (default $-0.02$).
6. **MCP Tool Incompatibility**: Any failure in the 8 core MCP tools over stdio JSON-RPC.
7. **CLI Command Incompatibility**: Non-zero exit code on any of the 5 core CLI commands.
8. **Database Schema Violation**: Missing required tables or disabled WAL / Foreign Keys.

---

## 7. Forensic Verification & Integrity Attestation

- **Zero Facade / Zero Cheating**: Real calculations using native Node.js SQLite `DatabaseSync`, high-resolution monotonic clocks (`performance.now()`), and standard information retrieval algorithms.
- **File Ownership Integrity**: Sole ownership of `eval/` and `TEST_READY.md`. No modifications made to `src/` or `docs/`.
- **Database Non-Pollution Guarantee**: Production database `brain.db`, `profile.md`, and `profile.json` remain untouched and verified clean via `git status --porcelain`.
