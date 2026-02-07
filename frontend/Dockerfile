# ============================================================================
# Base Stage - Common setup for all stages
# ============================================================================
FROM node:20-alpine AS base

# Install compatibility libraries
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ============================================================================
# Dependencies Stage - Install production dependencies
# ============================================================================
FROM base AS dependencies

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ============================================================================
# Development Stage - Full development environment
# ============================================================================
FROM base AS development

# Install development dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Expose frontend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start development server with Turbopack
CMD ["npm", "run", "dev"]

# ============================================================================
# Builder Stage - Build the application
# ============================================================================
FROM base AS builder

# Install all dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
RUN npm run build

# ============================================================================
# Production Stage - Optimized production image
# ============================================================================
FROM base AS production

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose frontend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start production server
CMD ["node", "server.js"]
