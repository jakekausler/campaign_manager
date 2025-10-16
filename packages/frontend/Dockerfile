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
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/frontend ./packages/frontend
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build shared package first
RUN pnpm --filter @campaign/shared build

# Build the frontend application
RUN pnpm --filter @campaign/frontend build

# =================================================================
# Production Stage - Nginx
# =================================================================
FROM nginx:1.25-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nginx-group && \
    adduser -S nginx-user -u 1001 -G nginx-group

# Copy custom nginx configuration
COPY --chown=nginx-user:nginx-group packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --chown=nginx-user:nginx-group --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Fix permissions
RUN chown -R nginx-user:nginx-group /usr/share/nginx/html && \
    chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/log/nginx && \
    chown -R nginx-user:nginx-group /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-group /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
