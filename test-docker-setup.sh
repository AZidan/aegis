#!/bin/bash

# Aegis Platform - Docker Setup Verification Script
# This script verifies that the Docker setup is correct

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aegis Platform - Docker Setup Verifier   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
echo -e "${BLUE}[1/10]${NC} Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✔${NC} Docker found: $DOCKER_VERSION"
else
    echo -e "${RED}✖${NC} Docker not found. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
echo -e "${BLUE}[2/10]${NC} Checking Docker Compose installation..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✔${NC} Docker Compose found: $COMPOSE_VERSION"
else
    echo -e "${RED}✖${NC} Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

# Check if Docker is running
echo -e "${BLUE}[3/10]${NC} Checking if Docker daemon is running..."
if docker info &> /dev/null; then
    echo -e "${GREEN}✔${NC} Docker daemon is running"
else
    echo -e "${RED}✖${NC} Docker daemon is not running. Please start Docker."
    exit 1
fi

# Check required files exist
echo -e "${BLUE}[4/10]${NC} Checking required configuration files..."
FILES=(
    "docker-compose.yml"
    "docker-compose.prod.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "backend/.dockerignore"
    "frontend/.dockerignore"
    ".env.production.example"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✔${NC} Found: $file"
    else
        echo -e "${RED}  ✖${NC} Missing: $file"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}✖${NC} Some required files are missing"
    exit 1
fi

# Check ports availability
echo -e "${BLUE}[5/10]${NC} Checking port availability..."
PORTS=(3000 3001 5432 6379)
PORTS_AVAILABLE=true

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}  ⚠${NC} Port $port is in use"
        PORTS_AVAILABLE=false
    else
        echo -e "${GREEN}  ✔${NC} Port $port is available"
    fi
done

if [ "$PORTS_AVAILABLE" = false ]; then
    echo -e "${YELLOW}⚠${NC} Some ports are in use. You may need to stop existing services."
fi

# Check backend package.json scripts
echo -e "${BLUE}[6/10]${NC} Checking backend package.json scripts..."
if grep -q "docker:migrate" backend/package.json; then
    echo -e "${GREEN}✔${NC} Docker migration scripts found in backend"
else
    echo -e "${RED}✖${NC} Docker migration scripts missing in backend/package.json"
    exit 1
fi

# Check frontend Next.js config
echo -e "${BLUE}[7/10]${NC} Checking frontend Next.js configuration..."
if grep -q "standalone" frontend/next.config.ts 2>/dev/null || grep -q "standalone" frontend/next.config.js 2>/dev/null; then
    echo -e "${GREEN}✔${NC} Next.js standalone output configured"
else
    echo -e "${YELLOW}⚠${NC} Next.js standalone output not configured (may affect production builds)"
fi

# Check Prisma schema
echo -e "${BLUE}[8/10]${NC} Checking Prisma schema..."
if [ -f "backend/prisma/schema.prisma" ]; then
    echo -e "${GREEN}✔${NC} Prisma schema found"
else
    echo -e "${RED}✖${NC} Prisma schema not found at backend/prisma/schema.prisma"
    exit 1
fi

# Check environment examples
echo -e "${BLUE}[9/10]${NC} Checking environment file examples..."
if [ -f "backend/.env.example" ]; then
    echo -e "${GREEN}✔${NC} Backend .env.example found"
else
    echo -e "${YELLOW}⚠${NC} Backend .env.example not found"
fi

if [ -f "frontend/.env.local.example" ]; then
    echo -e "${GREEN}✔${NC} Frontend .env.local.example found"
else
    echo -e "${YELLOW}⚠${NC} Frontend .env.local.example not found"
fi

# Check docker-helper.sh
echo -e "${BLUE}[10/10]${NC} Checking helper script..."
if [ -f "docker-helper.sh" ] && [ -x "docker-helper.sh" ]; then
    echo -e "${GREEN}✔${NC} docker-helper.sh found and executable"
else
    if [ -f "docker-helper.sh" ]; then
        echo -e "${YELLOW}⚠${NC} docker-helper.sh found but not executable. Run: chmod +x docker-helper.sh"
    else
        echo -e "${RED}✖${NC} docker-helper.sh not found"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Verification Complete            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✔${NC} Docker setup verification passed!"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Run: ./docker-helper.sh start"
echo "  2. Run: ./docker-helper.sh db-migrate"
echo "  3. Access: http://localhost:3001 (frontend)"
echo "  4. Access: http://localhost:3000 (backend)"
echo ""
echo -e "For more information, see ${BLUE}README_DOCKER.md${NC}"
echo ""
