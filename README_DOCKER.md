# Aegis Platform - Docker Setup Guide

Complete guide for running Aegis Platform with Docker for development and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Production Deployment](#production-deployment)
- [Database Migrations](#database-migrations)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

---

## Prerequisites

- **Docker**: Version 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose**: Version 2.0+ ([Install Docker Compose](https://docs.docker.com/compose/install/))
- **Git**: For cloning the repository
- **Available Ports**: 3000 (backend), 3001 (frontend), 5432 (postgres), 6379 (redis)

### Verify Installation

```bash
docker --version
docker-compose --version
```

---

## Quick Start (Development)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ai-transformation
```

### 2. Start All Services

```bash
docker-compose up -d
```

This command will:
- Pull required Docker images (PostgreSQL 16, Redis 7, Node 20)
- Build backend and frontend containers
- Create isolated network for services
- Start all containers in detached mode

### 3. Run Database Migrations

```bash
# Generate Prisma Client
docker-compose exec backend npm run prisma:generate

# Run migrations
docker-compose exec backend npm run docker:migrate:dev

# (Optional) Seed database
docker-compose exec backend npm run docker:seed
```

### 4. Verify Services

```bash
# Check all services are running
docker-compose ps

# Check backend health
curl http://localhost:3000/health

# Check frontend
curl http://localhost:3001
```

### 5. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f redis
```

### 6. Access Applications

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api
- **Prisma Studio**: Run `docker-compose exec backend npm run prisma:studio`

---

## Production Deployment

### 1. Prepare Environment Variables

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit with secure values
nano .env.production
```

**CRITICAL**: Update these values in `.env.production`:
- `POSTGRES_PASSWORD`: Strong password (min 16 chars)
- `REDIS_PASSWORD`: Strong password (min 16 chars)
- `JWT_ACCESS_SECRET`: Random string (min 32 chars)
- `JWT_REFRESH_SECRET`: Different random string (min 32 chars)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth credentials
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: OAuth credentials
- `CORS_ORIGINS`: Your production domain(s)
- `NEXT_PUBLIC_API_URL`: Your backend API URL

### 2. Build Production Images

```bash
# Build all production images
docker-compose -f docker-compose.prod.yml build

# Or build individual services
docker-compose -f docker-compose.prod.yml build backend
docker-compose -f docker-compose.prod.yml build frontend
```

### 3. Deploy Production Stack

```bash
# Start all services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
```

### 4. Run Production Migrations

```bash
# Run migrations (non-interactive)
docker-compose -f docker-compose.prod.yml exec backend npm run docker:migrate
```

### 5. Monitor Production Logs

```bash
# Tail logs from all services
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Check specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

---

## Database Migrations

### Development Migrations

```bash
# Create new migration
docker-compose exec backend npm run prisma:migrate -- --name your_migration_name

# Apply pending migrations
docker-compose exec backend npm run docker:migrate:dev

# Reset database (WARNING: Deletes all data)
docker-compose exec backend npm run docker:reset

# Open Prisma Studio
docker-compose exec backend npm run prisma:studio
```

### Production Migrations

```bash
# Apply migrations (production)
docker-compose -f docker-compose.prod.yml exec backend npm run docker:migrate

# Check migration status
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate status
```

### Migration Best Practices

1. **Always test migrations in development first**
2. **Backup production database before running migrations**
3. **Use descriptive migration names**: `add_user_roles`, `create_agents_table`
4. **Review generated SQL before applying**

---

## Common Operations

### Starting/Stopping Services

```bash
# Start all services
docker-compose up -d

# Stop all services (preserves data)
docker-compose stop

# Stop and remove containers (preserves volumes)
docker-compose down

# Stop and remove containers + volumes (DELETES DATA)
docker-compose down -v
```

### Rebuilding Services

```bash
# Rebuild specific service
docker-compose up -d --build backend

# Rebuild all services
docker-compose up -d --build

# Force rebuild without cache
docker-compose build --no-cache
```

### Accessing Container Shells

```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell
docker-compose exec frontend sh

# PostgreSQL shell
docker-compose exec postgres psql -U postgres -d aegis_dev

# Redis CLI
docker-compose exec redis redis-cli
```

### Viewing Resource Usage

```bash
# Show resource usage
docker stats

# Show container details
docker-compose ps -a

# Show disk usage
docker system df
```

### Database Backup & Restore

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres aegis_dev > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker-compose exec -T postgres psql -U postgres aegis_dev < backup_20260206_120000.sql

# Copy backup from container
docker cp aegis-postgres:/backup.sql ./backup.sql
```

### Cleaning Up

```bash
# Remove stopped containers
docker-compose down

# Remove unused images
docker image prune -a

# Remove unused volumes (CAUTION: Deletes data)
docker volume prune

# Complete cleanup (CAUTION: Removes everything)
docker system prune -a --volumes
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker-compose logs backend

# Check if ports are in use
lsof -i :3000
lsof -i :3001
lsof -i :5432
lsof -i :6379

# Restart specific service
docker-compose restart backend
```

### Database Connection Issues

```bash
# Check PostgreSQL is healthy
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection from backend
docker-compose exec backend npx prisma db execute --stdin <<< "SELECT 1"

# Check DATABASE_URL
docker-compose exec backend printenv DATABASE_URL
```

### Prisma Client Not Found

```bash
# Regenerate Prisma Client
docker-compose exec backend npm run prisma:generate

# Rebuild backend container
docker-compose up -d --build backend
```

### Redis Connection Issues

```bash
# Check Redis is healthy
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis
```

### Frontend Can't Connect to Backend

```bash
# Check backend is running
curl http://localhost:3000/health

# Check NEXT_PUBLIC_API_URL
docker-compose exec frontend printenv NEXT_PUBLIC_API_URL

# Check network connectivity
docker-compose exec frontend wget -O- http://backend:3000/health
```

### Out of Disk Space

```bash
# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a

# Remove old volumes (CAUTION)
docker volume ls -qf dangling=true | xargs docker volume rm
```

### Performance Issues

```bash
# Check resource limits
docker stats

# Increase Docker resources (Docker Desktop):
# Settings > Resources > Adjust CPU/Memory

# Check logs for errors
docker-compose logs --tail=100
```

---

## Architecture

### Container Structure

```
┌─────────────────────────────────────────────────────┐
│                  aegis-network                       │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                │
│  │   Frontend   │  │   Backend    │                │
│  │  (Next.js)   │  │  (NestJS)    │                │
│  │  Port: 3001  │  │  Port: 3000  │                │
│  └──────┬───────┘  └──────┬───────┘                │
│         │                  │                         │
│         └─────────┬────────┘                         │
│                   │                                  │
│         ┌─────────┴───────────┐                     │
│         │                     │                      │
│  ┌──────▼───────┐    ┌───────▼──────┐              │
│  │  PostgreSQL  │    │    Redis     │              │
│  │  Port: 5432  │    │  Port: 6379  │              │
│  └──────────────┘    └──────────────┘              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Volume Mounts (Development)

- `./backend:/app` - Backend source code (hot reload)
- `./frontend:/app` - Frontend source code (hot reload)
- `/app/node_modules` - Isolated node_modules (not mounted)
- `/app/.next` - Next.js build cache (not mounted)
- `/app/dist` - NestJS build output (not mounted)
- `postgres_data` - PostgreSQL data persistence
- `redis_data` - Redis data persistence

### Health Checks

- **Backend**: HTTP GET /health (30s interval)
- **Frontend**: HTTP GET / (30s interval)
- **PostgreSQL**: pg_isready command (10s interval)
- **Redis**: redis-cli ping (10s interval)

### Resource Limits (Production)

- **Backend**: 2 CPU, 2GB RAM
- **Frontend**: 1 CPU, 1GB RAM
- **PostgreSQL**: 2 CPU, 2GB RAM
- **Redis**: 1 CPU, 512MB RAM

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Description | Development Default | Production |
|----------|-------------|---------------------|------------|
| `NODE_ENV` | Application environment | `development` | `production` |
| `PORT` | Backend port | `3000` | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@postgres:5432/aegis_dev` | Set in .env.production |
| `REDIS_HOST` | Redis hostname | `redis` | `redis` |
| `REDIS_PORT` | Redis port | `6379` | `6379` |
| `REDIS_PASSWORD` | Redis password | `` | Set in .env.production |
| `JWT_ACCESS_SECRET` | JWT access token secret | `dev-super-secret-access-key-change-in-production` | Set in .env.production |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | `dev-super-secret-refresh-key-change-in-production` | Set in .env.production |

### Frontend Environment Variables

| Variable | Description | Development Default | Production |
|----------|-------------|---------------------|------------|
| `NODE_ENV` | Application environment | `development` | `production` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3000` | Set in .env.production |

---

## Commands Reference

### Development Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart service
docker-compose restart <service>

# View logs
docker-compose logs -f <service>

# Execute command in container
docker-compose exec <service> <command>

# Remove containers
docker-compose down

# Remove containers + volumes
docker-compose down -v
```

### Production Commands

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml stop

# Remove containers
docker-compose -f docker-compose.prod.yml down
```

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Docker Guide](https://docs.nestjs.com/recipes/prisma#docker)
- [Next.js Docker Guide](https://nextjs.org/docs/deployment#docker-image)
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/docker)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review container logs: `docker-compose logs -f`
3. Check GitHub Issues
4. Contact DevOps team

---

**Last Updated**: 2026-02-06
**Version**: 1.0.0
**Maintainer**: Aegis DevOps Team
