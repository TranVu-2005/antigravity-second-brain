---
name: performance-profiler
description: Deep system performance profiling, bottleneck diagnosis, and optimization engineering. Use when investigating high CPU load, memory leaks (heap snapshot analysis), event loop lag in Node.js, database query latency (EXPLAIN ANALYZE), caching strategies (Redis, LRU), and concurrency deadlocks.
---

# Performance Profiler: Deep System Bottleneck Diagnosis & Optimization

> *"Premature optimization is the root of all evil. But unmeasured performance is pure negligence."*

When optimizing system performance for Ngài, always adhere to the scientific method: **Measure ➔ Profile ➔ Hypothesize ➔ Optimize ➔ Benchmark**.

---

## 1. Golden Rules of High Performance

1. **The I/O Law:**
   - 90% of performance issues in web and backend services are I/O bound (un-indexed DB queries, N+1 queries, un-pooled HTTP requests, synchronous disk access).
   - Never run blocking disk/network calls inside the main event loop or critical path.
2. **Batching over Iteration:**
   - Replace N individual queries with 1 batch query (`SELECT ... WHERE id IN (...)` or `INSERT INTO ... VALUES (...), (...)`).
   - Use DataLoader patterns in GraphQL or nested REST loaders.
3. **Database Query Diagnostics:**
   - Always run `EXPLAIN QUERY PLAN` (SQLite) or `EXPLAIN (ANALYZE, BUFFERS)` (Postgres).
   - If you see `SCAN TABLE` on a table with >1,000 rows without an index, create an index immediately.

---

## 2. Memory Leak & Garbage Collection Diagnosis

- **Symptoms:** Steadily rising memory (RSS) that never recovers after GC passes, eventually triggering OS OOM kill.
- **Root Causes Checklist:**
  - Unbounded collections: Caches or arrays growing indefinitely without eviction policies (missing TTL or LRU cap).
  - Forgotten Event Listeners: `emitter.on(...)` without corresponding `emitter.removeListener(...)` inside component lifecycles.
  - Closures retaining large parent scope contexts.
  - Global variable or singleton pollution.
- **Profiling Action:**
  - Take 3 heap snapshots (Baseline ➔ Under Load ➔ After Load). Compare objects allocated between Snapshot 1 and 3 to pinpoint retained instances.

---

## 3. High-Throughput Caching Architecture

- **L1 Cache (In-Memory):** Microsecond access for hottest static lookups (LRU Map with max entries).
- **L2 Cache (Distributed):** Redis / Memcached with explicit TTL, cache key versioning, and stale-while-revalidate patterns.
- **Cache Stampede Prevention:**
  - Implement single-flight / mutex locks (e.g. `golang.org/x/sync/singleflight` or Redis distributed locks) so that on cache miss, only 1 worker queries the origin database while others wait.
