# ============================================================================
# Base Stage - Common setup for all stages
# ============================================================================
FROM node:20-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Set Prisma environment variables
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

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

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Generate Prisma Client and start development server
# Note: Prisma generate runs at startup when DATABASE_URL is available
CMD sh -c "npx prisma generate && npm run start:dev"]

# ============================================================================
# Builder Stage - Build the application
# ============================================================================
FROM base AS builder

# Set a dummy DATABASE_URL for build time
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Install all dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Generate Prisma Client (using dummy URL)
RUN npx prisma generate

# Build NestJS application
RUN npm run build

# ============================================================================
# Production Stage - Optimized production image
# ============================================================================
FROM base AS production

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy Prisma files and generated client
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nestjs

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start production server
CMD ["node", "dist/main"]
