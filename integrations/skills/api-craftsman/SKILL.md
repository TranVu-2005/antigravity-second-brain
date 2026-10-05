---
name: api-craftsman
description: Industrial-grade API design, contracts, and protocol engineering. Use when designing RESTful APIs, OpenAPI/Swagger schemas, gRPC Protobuf definitions, GraphQL schemas, WebSockets, error handling standards (RFC 7807 Problem Details), pagination, rate limiting, and idempotency key patterns.
---

# API Craftsman: Industrial-Grade Protocol & Contract Design

> *"APIs are permanent contracts. Once published, backwards compatibility is sacred."*

When designing APIs for Ngài, follow these international engineering standards:

---

## 1. RESTful Design Standards

- **Resource-Oriented URI Design:**
  - Plural nouns for collections: `/api/v1/users`, `/api/v1/projects/{id}/tasks`.
  - HTTP Verbs strictly reflect intent:
    - `GET`: Safe, idempotent, cached. Never mutates server state.
    - `POST`: Non-idempotent resource creation or action execution.
    - `PUT`: Complete replacement of resource (idempotent).
    - `PATCH`: Partial modification (JSON Patch or Merge Patch RFC 7396).
    - `DELETE`: Idempotent resource removal.

- **Status Codes Discipline:**
  - `200 OK`: Successful read or sync mutation.
  - `201 Created`: Resource created (include `Location: /api/v1/...` header).
  - `204 No Content`: Successful mutation returning no payload (e.g., DELETE).
  - `400 Bad Request`: Schema validation failure.
  - `401 Unauthorized`: Missing or invalid credentials.
  - `403 Forbidden`: Authenticated, but lacking permission.
  - `404 Not Found`: Resource does not exist.
  - `409 Conflict`: Unique constraint violation or state conflict.
  - `422 Unprocessable Entity`: Semantic/business validation error.
  - `429 Too Many Requests`: Rate limit reached (include `Retry-After`).

---

## 2. Standardized Error Handling: RFC 7807 Problem Details

Never return unstructured error strings or ad-hoc error shapes. Always use RFC 7807:

```json
{
  "type": "https://api.example.com/errors/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "The provided password does not match the account record.",
  "instance": "/api/v1/auth/login",
  "invalid_params": [
    { "name": "password", "reason": "Must be at least 8 characters" }
  ]
}
```

---

## 3. Mission-Critical Production Patterns

- **Idempotency Keys (`Idempotency-Key` header):**
  - Essential for all financial transactions, external notifications, and data creation.
  - Store key in cache (Redis) with TTL (e.g., 24h); if key matches an in-flight or completed request, return the cached result immediately without re-executing.
- **Keyset / Cursor Pagination:**
  - Avoid `OFFSET/LIMIT` for large datasets (O(N) performance cliff and phantom row bugs).
  - Use `?limit=50&after=cursor_id` based on indexed timestamp/ID.
- **Rate Limiting & Throttling:**
  - Standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **Contract-First Documentation:**
  - Maintain OpenAPI 3.1 specification. Generate typed clients (TypeScript, Go, Python) from OpenAPI rather than writing manual fetchers.
