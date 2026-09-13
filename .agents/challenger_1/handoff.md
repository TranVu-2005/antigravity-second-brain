# Challenger Handoff Report: Retrieval Pipeline Stress & Adversarial Evaluation

**Agent**: `challenger_1` (Empirical Challenger / Adversarial Reviewer)  
**Date**: 2026-09-13T07:48:00Z  
**Target Scope**: `src/semantic.js`, `src/retriever.js`, `src/embedding.js`  
**Empirical Verdict**: `REQUEST_CHANGES` (High structural resilience, but reproducible crashes on non-string inputs and null options)

---

## 1. Observation

Direct empirical observations and execution results collected via the adversarial test harness (`test/adversarial_retrieval_test.js`):

### 1.1 Test Suite Execution
- **Command executed**: `node test/adversarial_retrieval_test.js`
- **Total Test Cases**: 40 distinct adversarial cases across 7 functional suites
- **Overall Result**: 36 PASSED, 4 FAILED (Exit Code 1)

### 1.2 Verbatim Errors and Failure Points
1. **Failure 1.5a (Number Query to `searchKnowledge`)**:
   - **Command**: `semantic.searchKnowledge(12345)`
   - **Location**: `src/semantic.js:167`
   - **Verbatim Error**: `TypeError: query.trim is not a function`
   - **Code observed**:
     ```javascript
     if (!query || !query.trim()) {
     ```
   - When `typeof query === 'number'`, `!query` is `false`, and `query.trim()` is evaluated, causing a fatal TypeError.

2. **Failure 1.5b (Object Query to `searchKnowledge`)**:
   - **Command**: `semantic.searchKnowledge({ evil: true })`
   - **Location**: `src/semantic.js:167`
   - **Verbatim Error**: `TypeError: query.trim is not a function`

3. **Failure 1.8 (Number Query to `compileContext`)**:
   - **Command**: `retriever.compileContext(9999)`
   - **Location**: `src/retriever.js:48`
   - **Verbatim Error**: `TypeError: query.trim is not a function`
   - **Code observed**:
     ```javascript
     if (query && query.trim()) {
     ```
   - When `query` is a non-string truthy value, `query.trim()` throws.

4. **Failure 1.9 (Options Null to `compileContext`)**:
   - **Command**: `retriever.compileContext('bảo mật', null, null)`
   - **Location**: `src/retriever.js:33`
   - **Verbatim Error**: `TypeError: Cannot read properties of null (reading 'maxTokens')`
   - **Code observed**:
     ```javascript
     async compileContext(query = '', conversationId = null, options = {}) {
         const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
     ```
   - In JavaScript, default parameter `= {}` applies only when `options === undefined`. Passing `options = null` causes a fatal TypeError on property access.

### 1.3 Verified Robustness Findings (Passing Observations)
1. **SQL & FTS5 Injection Resistance (10/10 Passed)**:
   - Payloads tested:
     - `' OR '1'='1' --`
     - `'; DROP TABLE knowledge_items; --`
     - `' UNION SELECT 1, 'injected', ... --`
     - `NOT AND OR NEAR NOT`
     - `"""***^^^:::~~~((()))`
     - `"unclosed string literal`
     - `title: "secret" AND content: *`
     - `% _ [ ] ^ { } $ # @ !`
     - `{"$where": "sleep(5000)"}`
     - `'; DROP TABLE entities; --` in `compileContext`
   - **Observation**: Zero SQL errors, zero unhandled FTS5 syntax errors, zero data corruption. Tables remained 100% intact. Sanitizer `query.replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ').trim()` and SQL parameterized queries (`?`) completely neutralized all injection vectors.

2. **Massive Buffer & Extremely Long Queries (4/4 Passed)**:
   - 600-char complex Vietnamese query: 22.0ms latency, returned relevant results.
   - 2,500-char repeated phrase query (50 repetitions): 22.3ms latency, zero crashes.
   - 10,000-char buffer query (`"A".repeat(10000)`): 27.5ms latency in `searchKnowledge`, 1.5ms in `compileContext`. Token budget was strictly respected.

3. **Unicode, Diacritics & Multilingual (4/4 Passed)**:
   - Pure emojis (`🚀🔥🎉💡🧠💻⚡️`): Handled cleanly, returned valid candidates.
   - Mixed Vietnamese + Emojis: Passed, high retrieval precision.
   - Zero-width spaces (`\u200B\u200C\u200D`) and combining diacritics: Passed cleanly.
   - CJK & Arabic non-Latin scripts: Passed cleanly.

4. **Embedding Daemon Fallback Resilience (4/4 Passed)**:
   - **Online Mode**: FastEmbed daemon at `http://127.0.0.1:49152` responded in ~7.8ms with 384-dim Float32Array.
   - **Offline Mode**: Tested both under simulated `ECONNREFUSED` and by killing the actual daemon process. Fallback vector generated deterministically via Murmur3 hash in 0.03ms - 0.1ms.
   - **Unit L2 Norm**: Both neural and fallback vectors strictly verified unit L2 norm ($|\text{norm} - 1.0| < 10^{-4}$).
   - **Zero Crash**: System degraded gracefully to BM25 sparse FTS5 rankings + fallback vector with zero downtime.

5. **Throughput & Memory Stability (2/2 Passed)**:
   - 100 consecutive rapid queries completed in 842.1ms (~8.4ms/query online; 1.9ms/query offline).
   - Latency distribution: avg = 8.42ms, p50 = 8.15ms, p95 = 11.45ms, p99 = 12.08ms.
   - Memory stability: Heap delta = +1.76 MB, RSS delta = +12.98 MB (completely stable, bounded LRU cache).

---

## 2. Logic Chain

1. **Premise 1 (Observation 1.2)**: `searchKnowledge(query)` and `compileContext(query)` evaluate `query.trim()` without checking `typeof query === 'string'`.
2. **Premise 2 (Observation 1.2)**: If an external caller (e.g. MCP client, script, or programmatic consumer) passes a number, boolean, or object as `query`, JavaScript throws an unhandled `TypeError: query.trim is not a function`.
3. **Premise 3 (Code Comparison)**: In `src/embedding.js:110` and `src/semantic.js:336`, the author correctly included `typeof text !== 'string'` and `typeof entityName !== 'string'`. The omission in `searchKnowledge` and `compileContext` is an unintended gap in input validation.
4. **Premise 4 (Observation 1.2)**: `compileContext(query, conversationId, options = {})` fails with `TypeError: Cannot read properties of null` when `options === null`, because JavaScript default arguments only populate on `undefined`.
5. **Deduction**: While the system exhibits stellar architectural resilience against SQL/FTS injection, memory pressure, and daemon outages, it contains fragile entrypoints that will crash when invoked with non-string inputs or `options = null`.

---

## 3. Caveats

- **No Caveats** regarding the tested retrieval functions: all code paths in `src/semantic.js` and `src/retriever.js` were directly invoked and stress-tested.
- The daemon auto-restart logic uses Windows WMI `Win32_Process.Create`. Under normal desktop execution, the daemon remains backgrounded. In constrained CI container environments without WMI, auto-restart may rely purely on fallback Murmur vectors (which is verified to be crash-safe).

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

The retrieval pipeline (`src/semantic.js` and `src/retriever.js`) is architecturally sound, remarkably fast, and resilient against hostile text payloads (SQL injections, malformed FTS5 syntax, unicode stress, daemon failure, and buffer limits). 

However, before production release, the following 3 minimal, zero-risk fixes must be applied by the core engine worker:

### Required Remediation Items:
1. **Fix `src/semantic.js:167`**:
   Replace:
   ```javascript
   if (!query || !query.trim()) {
   ```
   With:
   ```javascript
   if (!query || typeof query !== 'string' || !query.trim()) {
   ```
2. **Fix `src/retriever.js:48`**:
   Replace:
   ```javascript
   if (query && query.trim()) {
   ```
   With:
   ```javascript
   if (query && typeof query === 'string' && query.trim()) {
   ```
3. **Fix `src/retriever.js:33`**:
   Replace:
   ```javascript
   async compileContext(query = '', conversationId = null, options = {}) {
       const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
   ```
   With:
   ```javascript
   async compileContext(query = '', conversationId = null, options = {}) {
       const opts = options || {};
       const maxTokens = opts.maxTokens || DEFAULT_MAX_TOKENS;
       const workspacePaths = opts.workspacePaths || [];
   ```

---

## 5. Verification Method

To independently reproduce the findings and verify future fixes:

1. **Execute the challenger test harness**:
   ```powershell
   node test/adversarial_retrieval_test.js
   ```
2. **Expected Verification Outcome Before Fix**:
   - 36 passed, 4 failed (failures on 1.5a, 1.5b, 1.8, 1.9).
3. **Expected Verification Outcome After Fix**:
   - 40 passed, 0 failed (100% PASS across all suites).
4. **Daemon Offline Invalidation Test**:
   - Terminate the daemon process and run:
     ```powershell
     node test/adversarial_retrieval_test.js
     ```
   - Confirms that test suite continues to pass with offline fallback vectors in < 2ms.
