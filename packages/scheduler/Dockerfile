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
COPY packages/scheduler/package.json ./packages/scheduler/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/scheduler ./packages/scheduler
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build the application
RUN pnpm --filter @campaign/shared build
RUN pnpm --filter @campaign/scheduler build

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
COPY --chown=worker:nodejs packages/scheduler/package.json ./packages/scheduler/
COPY --chown=worker:nodejs packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --chown=worker:nodejs --from=builder /app/packages/scheduler/dist ./packages/scheduler/dist
COPY --chown=worker:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist

# Switch to non-root user
USER worker

# Expose port
EXPOSE 9266

# Health check (HTTP health endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9266/health || exit 1

# Start the scheduler service
CMD ["node", "packages/scheduler/dist/main.js"]
