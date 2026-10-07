# ==============================================================================
# Antigravity Second Brain: Production Multi-Stage Dockerfile
# Follows devops-automation doctrine: Layer Caching, Minimal Base, Non-Root, Healthchecks
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependency Builder & Cache Layer
# ------------------------------------------------------------------------------
FROM node:24-alpine AS deps

WORKDIR /build

# Copy dependency manifests first to maximize Docker layer cache
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# ------------------------------------------------------------------------------
# Stage 2: Production Minimal Runtime
# ------------------------------------------------------------------------------
FROM node:24-alpine AS runner

# Set production environment
ENV NODE_ENV=production \
    BRAIN_DIR=/data/.antigravity_brain \
    PORT=3000

WORKDIR /app

# Prepare storage directory for persistent SQLite database
RUN mkdir -p /data /app && \
    chown -R node:node /app /data

# Copy installed production node_modules from deps stage
COPY --from=deps --chown=node:node /build/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node package.json ./
COPY --chown=node:node cli.js mcp_server.js setup.js ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node scripts/ ./scripts/

# Switch to unprivileged user (DevOps Non-Root Security Standard)
USER node

# Persistent data volume for SQLite databases & exports
VOLUME ["/data"]

# Native Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node scripts/healthcheck.js || exit 1

# Standard MCP stdio interface or daemon execution
CMD ["node", "mcp_server.js"]
