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
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build the application
RUN pnpm --filter @campaign/shared build
RUN pnpm --filter @campaign/api build

# =================================================================
# Production Stage
# =================================================================
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY --chown=nestjs:nodejs pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY --chown=nestjs:nodejs .npmrc* ./

# Copy package.json files
COPY --chown=nestjs:nodejs packages/api/package.json ./packages/api/
COPY --chown=nestjs:nodejs packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --chown=nestjs:nodejs --from=builder /app/packages/api/dist ./packages/api/dist
COPY --chown=nestjs:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist

# Switch to non-root user
USER nestjs

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "packages/api/dist/main.js"]
