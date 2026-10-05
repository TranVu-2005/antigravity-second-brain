---
name: tdd-master
description: Elite Test-Driven Development (TDD) and automated software testing guidelines. Use when writing unit tests, integration tests, end-to-end tests, designing mock architectures, identifying edge-case boundary conditions, testing race conditions, and setting up test runners (Vitest, Jest, PyTest, Go test).
---

# TDD Master: Elite Automated Testing & Quality Engineering

> *"Untested code is broken by design. Code with tests is a fortress against regression."*

As an elite test engineer serving Ngài, follow this doctrine to deliver bulletproof software:

---

## 1. The Red-Green-Refactor Lifecycle

Never write production implementation before defining the verification contract:
1. **Red (Failing Test):** Write the smallest possible test capturing the desired behavior, interface, or bug. Run it to confirm failure for the *right reason*.
2. **Green (Passing Implementation):** Write the simplest, most direct code that satisfies the test. Do not anticipate future features.
3. **Refactor (Cleanliness):** Clean up duplication, improve naming, optimize performance, while keeping the test suite green at every step.

---

## 2. Test Architecture: The Testing Pyramid

1. **Unit Tests (70%):**
   - High velocity, isolated, in-memory.
   - Pure functions, domain models, business logic invariants.
   - Zero network I/O, zero filesystem dependencies (use memory adapters or mocks).
2. **Integration Tests (20%):**
   - Verify interaction between 2+ components (e.g., Service + Database, Repository + SQLite WAL, Controller + Middleware).
   - Use ephemeral test databases (SQLite `:memory:` or spun-up test containers).
3. **End-to-End (E2E) & Smoke Tests (10%):**
   - Critical user paths only (e.g., Auth flow, Checkout, Data Backup & Restore).

---

## 3. The FIRST Principles of Quality Testing

- **F - Fast:** Test suite must run in seconds, enabling continuous local execution.
- **I - Independent / Isolated:** No test depends on the execution order or side effects of another test. Clean state before/after each (`beforeEach`, `afterEach`).
- **R - Repeatable:** Deterministic. No flaky tests depending on system time (`Date.now`), random seeds, or network latency. Mock clocks and RNG.
- **S - Self-Validating:** Tests produce a binary PASS or FAIL with crystal-clear assertion messages.
- **T - Thorough / Timely:** Cover edge cases:
  - Empty collections, null/undefined, boundary integers (0, -1, MAX_SAFE_INTEGER).
  - Malformed strings, Unicode, extreme length.
  - Concurrency & race conditions (concurrent writes, locking).
  - Timeout & connection drop recovery.

---

## 4. Modern Stack Best Practices

- **Node.js / TypeScript:** Prefer `node:test` (zero dependency) or `vitest` (blazing fast, ESM native).
- **Python:** Prefer `pytest` with fixtures and parameterized tests (`@pytest.mark.parametrize`).
- **Go:** Standard library `testing` with subtests (`t.Run`) and table-driven test patterns.
