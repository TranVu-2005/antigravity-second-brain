# Contributing to Antigravity Second Brain

Thank you for your interest in contributing to **Antigravity Second Brain**! We strive to engineer the world's most performant, zero-overhead long-term memory engine for AI agents.

---

## 🏛️ Core Principles

### 1. Ponytail Minimalist Philosophy
We strictly follow Dietrich Gebert's **7-Rung Decision Ladder**:
1. **Rung 1: Don't do it.** Avoid unnecessary features.
2. **Rung 2: Native platform capabilities.** Use operating system and Node.js built-ins (`node:sqlite`, `node:fs`, `node:child_process`, `node:test`).
3. **Rung 3: Zero external npm runtime dependencies.** `package.json` must not have bloated dependencies.
4. **Rung 7: Delete over refactor.** Prune code that is no longer needed.

### 2. TDD & Evidence Before Assertions
- Any new capability must be accompanied by an automated test under `test/`.
- Tests must prefer `:memory:` databases (`createTestDB(':memory:')`) to maintain isolation and speed (< 50ms per suite).

### 3. Cross-Platform Neutrality (Windows 11 & Linux Ubuntu)
- Paths must be normalized with `path.join()` or POSIX separators where appropriate.
- Shell scripts must have matching Windows (`.ps1`) and Linux (`.sh`) counterparts.
- Never hardcode user paths; always derive via `os.homedir()` or `process.env`.

---

## 🛠️ Development Workflow

### 1. Clone & Set Up
```bash
git clone https://github.com/TranVu-2005/antigravity-second-brain.git
cd antigravity-second-brain
node setup.js
```

### 2. Run Tests & Validation
```bash
# Validate JavaScript syntax across the repository
npm run lint

# Run the master test runner (all 5 test suites)
npm test

# Run specific version test track
npm run test:v3.5
npm run test:mcp
```

### 3. Conventional Commits
Use semantic commit messages:
- `feat(scope): add new feature`
- `fix(scope): resolve bug`
- `perf(scope): performance optimization`
- `test(scope): add or improve tests`
- `docs(scope): update documentation`
- `chore(scope): repository maintenance`

---

## 📄 License
By contributing to this repository, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
