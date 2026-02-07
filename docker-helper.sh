#!/bin/bash

# Aegis Platform - Docker Helper Script
# Provides convenient commands for Docker operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✔${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✖${NC} $1"
}

# Print usage
usage() {
    cat << EOF
Aegis Platform - Docker Helper Script

Usage: ./docker-helper.sh [command]

Development Commands:
  start           Start all services in development mode
  stop            Stop all services
  restart         Restart all services
  rebuild         Rebuild and restart all services
  logs            Show logs from all services
  logs-backend    Show backend logs
  logs-frontend   Show frontend logs
  status          Show status of all services
  shell-backend   Open shell in backend container
  shell-frontend  Open shell in frontend container

Database Commands:
  db-migrate      Run database migrations
  db-reset        Reset database (WARNING: Deletes all data)
  db-seed         Seed database with test data
  db-studio       Open Prisma Studio
  db-backup       Backup database to file
  db-restore      Restore database from backup file

Production Commands:
  prod-build      Build production images
  prod-start      Start production environment
  prod-stop       Stop production environment
  prod-logs       Show production logs

Cleanup Commands:
  clean           Remove stopped containers
  clean-all       Remove containers, volumes, and images (WARNING)
  clean-volumes   Remove volumes (WARNING: Deletes data)

Utility Commands:
  health          Check health of all services
  ps              Show running containers
  stats           Show resource usage
  help            Show this help message

Examples:
  ./docker-helper.sh start
  ./docker-helper.sh db-migrate
  ./docker-helper.sh logs-backend
  ./docker-helper.sh prod-build

EOF
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Development commands
cmd_start() {
    print_info "Starting all services in development mode..."
    docker-compose up -d
    print_success "Services started successfully"
    print_info "Frontend: http://localhost:3001"
    print_info "Backend: http://localhost:3000"
    print_info "Run './docker-helper.sh logs' to view logs"
}

cmd_stop() {
    print_info "Stopping all services..."
    docker-compose stop
    print_success "Services stopped successfully"
}

cmd_restart() {
    print_info "Restarting all services..."
    docker-compose restart
    print_success "Services restarted successfully"
}

cmd_rebuild() {
    print_info "Rebuilding and restarting all services..."
    docker-compose up -d --build
    print_success "Services rebuilt and restarted successfully"
}

cmd_logs() {
    print_info "Showing logs from all services (Ctrl+C to exit)..."
    docker-compose logs -f --tail=100
}

cmd_logs_backend() {
    print_info "Showing backend logs (Ctrl+C to exit)..."
    docker-compose logs -f --tail=100 backend
}

cmd_logs_frontend() {
    print_info "Showing frontend logs (Ctrl+C to exit)..."
    docker-compose logs -f --tail=100 frontend
}

cmd_status() {
    print_info "Status of all services:"
    docker-compose ps
}

cmd_shell_backend() {
    print_info "Opening shell in backend container..."
    docker-compose exec backend sh
}

cmd_shell_frontend() {
    print_info "Opening shell in frontend container..."
    docker-compose exec frontend sh
}

# Database commands
cmd_db_migrate() {
    print_info "Running database migrations..."
    docker-compose exec backend npm run docker:migrate:dev
    print_success "Migrations completed successfully"
}

cmd_db_reset() {
    print_warning "This will DELETE ALL DATA in the database!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        print_info "Resetting database..."
        docker-compose exec backend npm run docker:reset
        print_success "Database reset successfully"
    else
        print_info "Operation cancelled"
    fi
}

cmd_db_seed() {
    print_info "Seeding database..."
    docker-compose exec backend npm run docker:seed
    print_success "Database seeded successfully"
}

cmd_db_studio() {
    print_info "Opening Prisma Studio..."
    print_info "Access at: http://localhost:5555"
    docker-compose exec backend npm run prisma:studio
}

cmd_db_backup() {
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    print_info "Creating database backup: $BACKUP_FILE"
    docker-compose exec postgres pg_dump -U postgres aegis_dev > "$BACKUP_FILE"
    print_success "Backup created: $BACKUP_FILE"
}

cmd_db_restore() {
    if [ -z "$1" ]; then
        print_error "Please provide backup file: ./docker-helper.sh db-restore backup_20260206_120000.sql"
        exit 1
    fi
    if [ ! -f "$1" ]; then
        print_error "Backup file not found: $1"
        exit 1
    fi
    print_warning "This will OVERWRITE the current database!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        print_info "Restoring database from: $1"
        docker-compose exec -T postgres psql -U postgres aegis_dev < "$1"
        print_success "Database restored successfully"
    else
        print_info "Operation cancelled"
    fi
}

# Production commands
cmd_prod_build() {
    print_info "Building production images..."
    docker-compose -f docker-compose.prod.yml build
    print_success "Production images built successfully"
}

cmd_prod_start() {
    if [ ! -f ".env.production" ]; then
        print_error "Production environment file not found: .env.production"
        print_info "Copy .env.production.example to .env.production and configure it first"
        exit 1
    fi
    print_info "Starting production environment..."
    docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
    print_success "Production environment started successfully"
}

cmd_prod_stop() {
    print_info "Stopping production environment..."
    docker-compose -f docker-compose.prod.yml stop
    print_success "Production environment stopped successfully"
}

cmd_prod_logs() {
    print_info "Showing production logs (Ctrl+C to exit)..."
    docker-compose -f docker-compose.prod.yml logs -f --tail=100
}

# Cleanup commands
cmd_clean() {
    print_info "Removing stopped containers..."
    docker-compose down
    print_success "Cleanup completed"
}

cmd_clean_all() {
    print_warning "This will remove all containers, volumes, and images!"
    print_warning "ALL DATA WILL BE LOST!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        print_info "Removing all Docker resources..."
        docker-compose down -v
        docker system prune -a -f
        print_success "Complete cleanup finished"
    else
        print_info "Operation cancelled"
    fi
}

cmd_clean_volumes() {
    print_warning "This will DELETE ALL DATABASE DATA!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        print_info "Removing volumes..."
        docker-compose down -v
        print_success "Volumes removed"
    else
        print_info "Operation cancelled"
    fi
}

# Utility commands
cmd_health() {
    print_info "Checking health of all services..."
    echo ""

    # Check backend
    if curl -s http://localhost:3000/health > /dev/null; then
        print_success "Backend: Healthy (http://localhost:3000)"
    else
        print_error "Backend: Unhealthy or not running"
    fi

    # Check frontend
    if curl -s http://localhost:3001 > /dev/null; then
        print_success "Frontend: Healthy (http://localhost:3001)"
    else
        print_error "Frontend: Unhealthy or not running"
    fi

    # Check PostgreSQL
    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        print_success "PostgreSQL: Healthy"
    else
        print_error "PostgreSQL: Unhealthy or not running"
    fi

    # Check Redis
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis: Healthy"
    else
        print_error "Redis: Unhealthy or not running"
    fi
}

cmd_ps() {
    print_info "Running containers:"
    docker-compose ps
}

cmd_stats() {
    print_info "Resource usage (Ctrl+C to exit):"
    docker stats
}

# Main command router
main() {
    check_docker

    case "${1:-}" in
        start)          cmd_start ;;
        stop)           cmd_stop ;;
        restart)        cmd_restart ;;
        rebuild)        cmd_rebuild ;;
        logs)           cmd_logs ;;
        logs-backend)   cmd_logs_backend ;;
        logs-frontend)  cmd_logs_frontend ;;
        status)         cmd_status ;;
        shell-backend)  cmd_shell_backend ;;
        shell-frontend) cmd_shell_frontend ;;
        db-migrate)     cmd_db_migrate ;;
        db-reset)       cmd_db_reset ;;
        db-seed)        cmd_db_seed ;;
        db-studio)      cmd_db_studio ;;
        db-backup)      cmd_db_backup ;;
        db-restore)     cmd_db_restore "$2" ;;
        prod-build)     cmd_prod_build ;;
        prod-start)     cmd_prod_start ;;
        prod-stop)      cmd_prod_stop ;;
        prod-logs)      cmd_prod_logs ;;
        clean)          cmd_clean ;;
        clean-all)      cmd_clean_all ;;
        clean-volumes)  cmd_clean_volumes ;;
        health)         cmd_health ;;
        ps)             cmd_ps ;;
        stats)          cmd_stats ;;
        help|--help|-h) usage ;;
        *)
            print_error "Unknown command: ${1:-}"
            echo ""
            usage
            exit 1
            ;;
    esac
}

main "$@"
