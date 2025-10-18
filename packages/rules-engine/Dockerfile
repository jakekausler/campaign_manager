# =================================================================
# Build Stage
# =================================================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Copy all package.json files for dependency resolution
COPY packages/rules-engine/package.json ./packages/rules-engine/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/rules-engine ./packages/rules-engine
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build the application
RUN pnpm --filter @campaign/shared build
RUN pnpm --filter @campaign/rules-engine build

# =================================================================
# Production Stage
# =================================================================
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S worker -u 1001

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY --chown=worker:nodejs pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY --chown=worker:nodejs .npmrc* ./

# Copy package.json files
COPY --chown=worker:nodejs packages/rules-engine/package.json ./packages/rules-engine/
COPY --chown=worker:nodejs packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --chown=worker:nodejs --from=builder /app/packages/rules-engine/dist ./packages/rules-engine/dist
COPY --chown=worker:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist

# Switch to non-root user
USER worker

# Health check using HTTP liveness endpoint
# Checks if the service is alive and responding
# Interval: Check every 30 seconds
# Timeout: Wait 3 seconds for response
# Start Period: Wait 20 seconds before first check (for initialization)
# Retries: Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${HTTP_PORT:-3001}/health/live || exit 1

# Start the worker
CMD ["node", "packages/rules-engine/dist/main.js"]
