## 📌 Description
<!-- Provide a clear summary of changes and why they are needed -->

## 🎯 Cognitive Memory Tier Impacted
- [ ] Tier 0: Core Identity & User Profile (`src/profile.js`)
- [ ] Tier 1: Working Memory & Session Distillation (`src/consolidation.js`)
- [ ] Tier 2: Episodic Memory & Fast Batch Ingestion (`src/episodic.js`)
- [ ] Tier 3: Semantic Store, FastEmbed & Bi-Temporal Graph (`src/semantic.js`, `src/embedding.js`)
- [ ] Tier 4: Procedural Memory & Error Learning (`src/solutions.js`, `src/reinforcement.js`)
- [ ] MCP Server & Tool Schemas (`mcp_server.js`, `integrations/`)
- [ ] Infrastructure, Cross-Platform Scripts & CI/CD (`setup.js`, `install.*`, `.github/`)

## 🛡️ Ponytail Compliance Checklist
- [ ] **Zero External Dependencies:** No runtime npm dependencies added to `package.json`.
- [ ] **Standard Library Preference:** Utilizes Node.js built-ins (`node:sqlite`, `node:fs`, `node:child_process`).
- [ ] **Cross-Platform Parity:** Verified on both Windows and Linux / POSIX environments.
- [ ] **Backward Compatibility:** All existing database records and schemas remain intact.

## 🧪 Verification & Evidence
- [ ] Syntax check passed (`npm run lint`)
- [ ] All test suites passed cleanly (`npm test` / `node test/run_all_tests.js`)
- [ ] New automated unit/integration tests added for new behavior (`test/`)
