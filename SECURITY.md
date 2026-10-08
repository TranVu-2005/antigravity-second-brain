# Security Policy

## 🔒 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |
| < 0.0.1 | :x:                |

---

## 🛡️ Security Architecture & Guardrails

Antigravity Second Brain is engineered with strict local security principles:

1. **Zero Arbitrary External Network Exfiltration:**
   - Second Brain operates purely as an in-process and stdio engine with zero telemetry or third-party cloud data transmission.
   - It communicates exclusively through local IPC (stdio JSON-RPC) and local SQLite storage.
   - Cross-device data synchronization occurs strictly through intentional, user-configured Git remote commands (`git push`/`git pull`).
2. **Data & Privacy Isolation:**
   - Personal conversation logs, local hardware profiles, and credentials are strictly stored in a private repository (`antigravity-second-brain-data`).
   - The public engine repository enforces an export allowlist and pre-commit secret scanning.
3. **Command Injection Mitigation:**
   - Child process executions enforce direct argument arrays (`[binary, ...args]`) across all Git, Node, and external tool calls.
   - Proactive static security auditing (`scripts/security_check.js`) verifies no untrusted user input is passed to shell string interpolations.
4. **Binary & Transactional Safety:**
   - Built on top of Node.js official `node:sqlite` engine backed by upstream SQLite amalgamation with WAL journaling, parameterized queries (`?`), and atomic transactional restores (`BEGIN IMMEDIATE` + `PRAGMA integrity_check`).

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within Antigravity Second Brain, please report it privately:
- **Email:** Create a private security advisory on GitHub or contact the repository owner at `TranVu-2005`.
- Please include full reproduction steps and environment details. We will respond within 48 hours.
