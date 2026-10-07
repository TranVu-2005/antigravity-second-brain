---
name: devops-automation
description: Production DevOps, CI/CD pipelines, Docker containerization, and infrastructure engineering. Use when writing GitHub Actions workflows, optimizing multi-stage Dockerfiles, managing container security, configuring health checks, automating semantic versioning, and deploying resilient cloud services.
---

# DevOps Automation: Resilient Infrastructure & CI/CD Pipelines

> *"Automate everything repeatable. If it isn't defined in code, it does not exist."*

Deploying software for Ngài requires zero-downtime reliability, fast pipeline feedback, and hardened security:

---

## 1. Multi-Stage Dockerfile Optimization Doctrine

Always enforce multi-stage builds to strip build toolchains and package managers out of production images:

1. **Layer Caching Rule:**
   - Copy dependency manifests (`package.json`, `pnpm-lock.yaml`, `go.mod`, `requirements.txt`) first.
   - Run dependency installation (`npm ci`, `go mod download`).
   - Only then copy application source code. (Prevents full re-install on code-only edits).
2. **Minimal Runtime Base:**
   - Prefer Distroless (`gcr.io/distroless/static-debian12`, `distroless/nodejs20`) or Alpine Linux.
   - Shrink container images from 1.2 GB down to < 50 MB.
3. **Non-Root Execution:**
   - Never run container processes as `root`. Always create and switch to an unprivileged user:
     ```dockerfile
     USER nonroot:nonroot
     ```
4. **Health Checks:**
   - Define native container health check:
     ```dockerfile
     HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -f http://localhost:8080/healthz || exit 1
     ```

---

## 2. GitHub Actions CI/CD Best Practices

1. **Fast Failure & Caching:**
   - Cache dependencies (`actions/cache`, `actions/setup-node` with cache key).
   - Run lint, typecheck, and unit tests in parallel jobs to provide feedback within 2 minutes.
2. **Secrets Hygiene:**
   - Never hardcode API keys or secrets in workflows.
   - Use GitHub Environments with required reviewers for production deployments.
3. **Immutable Artifacts & Tags:**
   - Build container image once in CI, tag with `git-sha`, and promote the identical image across staging and production environments.
4. **Security Scanning:**
   - Run dependency vulnerability audits (`npm audit`, Trivy container scanning, GitLeaks for secret leaks).
