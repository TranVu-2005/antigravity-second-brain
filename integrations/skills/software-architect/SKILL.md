---
name: software-architect
description: Senior system architecture and software design guidelines. Use when designing system architectures, evaluating trade-offs (microservices vs modular monolith, sync vs async), database schema modeling, designing APIs (REST, gRPC, GraphQL), and drafting Architecture Decision Records (ADRs).
---

# Software Architect: System Design & Architectural Decision Framework

This skill empowers the agent to assist Ngài in making sound, battle-tested architectural choices.

## 1. Architectural First Principles

```
1. Evolutionary Design: Start with a Modular Monolith. Decouple when independent scaling is proven necessary.
2. Data Ownership: Every service/domain module must strictly own its datastore. Never share raw database tables across domain boundaries.
3. Observability First: Systems without structured logging, trace IDs, and health checks are unmaintainable in production.
4. Idempotency & Fault Tolerance: Assume network will fail, APIs will timeout, and processes will restart.
```

---

## 2. Decision Frameworks

### A. Modularity & Clean Architecture
- **Domain Layer:** Pure business logic. Zero dependencies on web frameworks or databases.
- **Application Layer:** Orchestration, use cases, transactional boundaries.
- **Infrastructure Layer:** Concrete implementations (Database repositories, HTTP clients, message queues).
- **Interface Layer:** Controllers, CLI handlers, API endpoints.

### B. Database Modeling & Storage Strategy
- **Relational (SQLite / Postgres):** Default choice for structured relational data, transactions, and strong consistency (ACID).
- **Document / Key-Value:** For unstructured blobs, rapid prototyping, or ephemeral caching.
- **Indexing Strategy:**
  - B-Tree indexes on foreign keys, filter predicates (`WHERE`), and sorting columns (`ORDER BY`).
  - Full-Text Search (FTS5 / GIN) for document/text search instead of slow `%wildcard%` queries.
  - Periodic `VACUUM` and `ANALYZE` for query planner optimization.

---

## 3. Architecture Decision Record (ADR) Template

When proposing architectural choices to Ngài, structure decisions as an ADR:

```markdown
# ADR-[NUMBER]: [Decision Title]

## Context & Problem Statement
[Briefly describe the context, requirements, and constraints]

## Considered Options
- **Option 1:** [Name] (Pros & Cons)
- **Option 2:** [Name] (Pros & Cons)

## Decision Outcome
Chosen option: **[Option Name]** because [primary architectural rationale].

### Consequences
- **Positive:** [Key benefits, latency/cost/reliability improvements]
- **Negative / Trade-offs:** [Added complexity or operational overhead]
```
