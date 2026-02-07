# Docker Quick Start Guide

Get Aegis Platform running with Docker in 5 minutes.

## Prerequisites

- Docker Desktop installed and running
- Ports 3000, 3001, 5432, 6379 available

## Option 1: Using Helper Script (Recommended)

```bash
# 1. Start all services
./docker-helper.sh start

# 2. Run database migrations
./docker-helper.sh db-migrate

# 3. Check service health
./docker-helper.sh health

# 4. View logs
./docker-helper.sh logs
```

Access the application:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

## Option 2: Using Docker Compose Directly

```bash
# 1. Start all services
docker-compose up -d

# 2. Run migrations
docker-compose exec backend npm run docker:migrate:dev

# 3. View logs
docker-compose logs -f

# 4. Check status
docker-compose ps
```

## Common Operations

### View Logs
```bash
./docker-helper.sh logs-backend   # Backend logs
./docker-helper.sh logs-frontend  # Frontend logs
```

### Database Operations
```bash
./docker-helper.sh db-studio      # Open Prisma Studio
./docker-helper.sh db-backup      # Backup database
./docker-helper.sh db-seed        # Seed test data
```

### Restart Services
```bash
./docker-helper.sh restart        # Restart all
./docker-helper.sh rebuild        # Rebuild and restart
```

### Stop Services
```bash
./docker-helper.sh stop           # Stop all services
./docker-helper.sh clean          # Stop and remove containers
```

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker info

# Check port conflicts
lsof -i :3000
lsof -i :3001

# View error logs
./docker-helper.sh logs
```

### Database connection errors
```bash
# Check PostgreSQL health
docker-compose ps postgres

# Regenerate Prisma client
docker-compose exec backend npm run prisma:generate
```

### Need to reset everything
```bash
# Stop and remove everything (keeps volumes)
./docker-helper.sh clean

# Start fresh
./docker-helper.sh start
./docker-helper.sh db-migrate
```

## Full Documentation

See [README_DOCKER.md](./README_DOCKER.md) for complete documentation.

## Helper Script Commands

```bash
./docker-helper.sh help           # Show all commands
./docker-helper.sh status         # Show service status
./docker-helper.sh health         # Check service health
./docker-helper.sh ps             # List containers
./docker-helper.sh stats          # Show resource usage
```
