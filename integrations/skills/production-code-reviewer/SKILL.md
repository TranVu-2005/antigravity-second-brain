---
name: production-code-reviewer
description: Elite production-grade code review guidelines. Use when reviewing pull requests, inspecting codebases, auditing security vulnerabilities, analyzing concurrency safety, memory leaks, and performance bottlenecks.
---

# Production Code Reviewer: The Elite Engineering Standard

This skill equips the agent to perform senior-level, production-grade code reviews for Ngài.

## 1. The 5 Pillars of Production Review

```
1. Security & Vulnerability (OWASP, Injection, Secrets, Permissions)
2. Concurrency & Async Safety (Race conditions, Deadlocks, Resource leaks)
3. Performance & Resource Limits (N+1 queries, unindexed scans, OOM risks)
4. Reliability & Error Resilience (Graceful degradation, structured logging)
5. Simplicity & Maintainability (Cognitive load, Ponytail ladder compliance)
```

---

## 2. Deep Dive Auditing Categories

### A. Security Guardrails
- **Injection:** Ensure all database queries use parameterized prepared statements (`?` or `$1`). Never concatenate raw strings into SQL, Shell commands, or HTML.
- **Secrets Management:** Check that no API keys, tokens, or private credentials exist in source code or Git history.
- **Path Traversal:** Validate and sanitize all user-supplied file paths (`path.resolve`, checking if target starts with base directory).
- **Authentication & Authorization:** Verify permission checks are applied at the service/controller boundary, not just the client UI.

### B. Concurrency & Async Patterns
- **Resource Leaks:** Ensure every open file descriptor, database connection, or socket is properly closed inside `finally` blocks or using context managers / `using` syntax.
- **Race Conditions:** Audit read-modify-write patterns on shared mutable state. Enforce transactions (`BEGIN TRANSACTION ... COMMIT`) or atomic operations.
- **Unhandled Rejections:** Verify all promises have `.catch()` or are wrapped in `try/catch`. Never swallow errors silently without logging.

### C. Performance & Scalability
- **Database & I/O:** Look for unindexed column filters (`WHERE`), missing composite indexes on frequent multi-column queries, or N+1 query loops.
- **Memory Footprint:** Detect unbounded array growth in long-running processes (caches without TTL/LRU, unremoved event listeners, circular references).
- **Batching & Buffering:** Avoid reading entire gigabyte files into memory (`fs.readFileSync`) when streams (`fs.createReadStream`) should be used.

---

## 3. Review Output Format

When delivering a review to Ngài, format findings concisely:

```markdown
### 🔍 Audit Summary: [File or Component Name]
- **Verdict:** [APPROVE / REQUEST_CHANGES / CRITICAL_FIX_NEEDED]

#### 🚨 Critical Issues (Must fix before production)
1. **[Vulnerability / Bug Title]** (Location: `path/to/file.ts:L45`)
   - *Impact:* [Explanation of risk, e.g. SQL Injection or OOM]
   - *Fix:* [Concrete, concise drop-in code fix]

#### ⚡ Optimizations (Ponytail & Performance)
1. **[Opportunity]** (Location: `path/to/file.ts:L12`)
   - *Suggestion:* [Simpler native alternative]
```
