# Security Policy

## 🔒 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.5.x   | :white_check_mark: |
| 3.4.x   | :white_check_mark: |
| < 3.4   | :x:                |

---

## 🛡️ Security Architecture & Guardrails

Antigravity Second Brain is engineered with strict local security principles:

1. **Zero External Network Exfiltration:**
   - Second Brain operates purely as an in-process and stdio engine.
   - It communicates exclusively through local IPC (stdio JSON-RPC) and local SQLite storage.
2. **Zero Credential Exposure:**
   - User secrets, API keys, and sensitive tokens are strictly excluded from snapshot exports (`exports/`).
   - Configuration templates in `integrations/` are sanitized and parameterized.
3. **Command Injection Mitigation:**
   - Child process executions strictly avoid passing untrusted user input to shell invocations.
   - Direct argument arrays are enforced across all child process calls.
4. **Binary & Memory Safety:**
   - Built on top of Node.js official `node:sqlite` engine backed by upstream SQLite amalgamation with WAL journaling and parameterized queries (`?`).

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within Antigravity Second Brain, please report it privately:
- **Email:** Create a private security advisory on GitHub or contact the repository owner at `TranVu-2005`.
- Please include full reproduction steps and environment details. We will respond within 48 hours.
