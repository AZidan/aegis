# Aegis Platform Backend

Multi-tenant AI Multi-Agent SaaS backend built with NestJS, TypeScript, PostgreSQL, and Redis.

## Tech Stack

- **Framework**: NestJS 10+
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 16+ (Prisma ORM 7)
- **Cache/Sessions**: Redis 7+
- **Authentication**: JWT + OAuth2 (Google, GitHub)
- **Validation**: Zod + class-validator
- **API Style**: REST + WebSocket

## Prerequisites

- Node.js 20+ LTS
- PostgreSQL 16+ (or 14+)
- Redis 7+
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

**Required environment variables:**

```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://postgres:password@localhost:5432/aegis_dev"

# JWT Secrets - MUST change in production (32+ characters)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Redis - Update if not using defaults
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (once database schema is ready)
npm run prisma:migrate

# Optional: Open Prisma Studio to view data
npm run prisma:studio
```

### 4. Start Development Server

```bash
npm run start:dev
```

The API will be available at: `http://localhost:3000/api`

Health check endpoint: `http://localhost:3000/api/health`

## Available Scripts

### Development

```bash
npm run start          # Start in production mode
npm run start:dev      # Start with watch mode
npm run start:debug    # Start with debug mode
```

### Build

```bash
npm run build          # Compile TypeScript to JavaScript
npm run start:prod     # Run compiled production build
```

### Code Quality

```bash
npm run format         # Format code with Prettier
npm run lint           # Lint code with ESLint
npm run lint -- --fix  # Auto-fix linting issues
```

### Testing

```bash
npm run test           # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:cov       # Generate coverage report
npm run test:e2e       # Run end-to-end tests
```

### Database

```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:deploy    # Deploy migrations (production)
```

## Project Structure

```
backend/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── app.controller.ts       # Health check endpoint
│   ├── app.service.ts          # App-level services
│   ├── auth/                   # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/             # JWT, roles guards
│   │   ├── decorators/         # Custom decorators
│   │   ├── strategies/         # JWT, OAuth strategies
│   │   └── dto/                # Auth DTOs
│   ├── admin/                  # Platform admin module
│   │   ├── admin.module.ts
│   │   ├── dashboard/          # Dashboard endpoints
│   │   └── tenants/            # Tenant management
│   ├── common/                 # Shared code
│   │   ├── filters/            # Exception filters
│   │   ├── interceptors/       # Logging, transform
│   │   ├── pipes/              # Validation pipes
│   │   ├── decorators/         # Shared decorators
│   │   └── types/              # Shared TypeScript types
│   ├── config/                 # Configuration
│   │   ├── configuration.ts    # Env config
│   │   └── validation.ts       # Env validation schema
│   └── prisma/                 # Database
│       ├── prisma.service.ts   # Prisma client service
│       └── prisma.module.ts    # Prisma module
├── prisma/
│   └── schema.prisma           # Database schema
├── test/                       # E2E tests
├── .env.example                # Environment template
├── .eslintrc.js                # ESLint config
├── .prettierrc                 # Prettier config
├── tsconfig.json               # TypeScript config
└── nest-cli.json               # NestJS CLI config
```

## API Documentation

API Contract (Single Source of Truth): `../docs/api-contract.md`

### Key Endpoints

**Authentication:**
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/login/oauth` - OAuth login (Google/GitHub)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `POST /api/auth/mfa/verify` - MFA verification
- `GET /api/auth/me` - Get current user

**Platform Admin:**
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/dashboard/alerts` - Active alerts
- `GET /api/admin/tenants` - List tenants
- `POST /api/admin/tenants` - Create tenant
- `GET /api/admin/tenants/:id` - Tenant detail

**Tenant Dashboard:**
- `GET /api/dashboard/stats` - Tenant statistics
- `GET /api/dashboard/agents` - List agents
- `POST /api/dashboard/agents` - Create agent
- `GET /api/dashboard/skills` - Browse skills
- `GET /api/dashboard/team` - Team members

### Error Response Format

All errors follow this standard format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "email": ["Invalid email format"],
    "password": ["Password must be at least 12 characters"]
  },
  "timestamp": "2026-02-06T10:30:00.000Z",
  "path": "/api/auth/login"
}
```

## Development Guidelines

### TypeScript Strict Mode

This project uses TypeScript strict mode. Key rules:

- ✅ **No `any` types** - Use proper typing
- ✅ **Explicit return types** - For public methods
- ✅ **Null checks** - Handle nullability properly
- ✅ **Proper generics** - Type-safe collections

### Code Quality Standards

1. **ESLint + Prettier**: Enforced on commit
2. **No console.log**: Use Logger instead
3. **Error handling**: Catch and format all errors
4. **Validation**: Use DTOs with class-validator
5. **Testing**: Write tests for business logic

### Security Best Practices

- ✅ Input validation on ALL endpoints
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS prevention (sanitize outputs)
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Secrets in .env only (never hardcoded)
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ JWT short expiry (15 minutes)

## Current Status

### Stage 1: Project Setup ✅ Complete

- [x] NestJS project initialized
- [x] All dependencies installed
- [x] TypeScript strict mode configured
- [x] ESLint + Prettier configured
- [x] Environment variables template
- [x] Prisma initialized (placeholder schema)
- [x] Base modules created (auth, admin, common, config)
- [x] Health check endpoint
- [x] Project builds successfully

### Stage 2: Database Schema (Next)

- [ ] Design complete Prisma schema
- [ ] Create database migrations
- [ ] Seed initial data

### Stage 3: Authentication (Sprint 1)

- [ ] Implement JWT authentication
- [ ] Implement OAuth2 (Google, GitHub)
- [ ] Implement MFA (TOTP)
- [ ] Implement role-based access control
- [ ] Session management (Redis)

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment (development, production, test) |
| `PORT` | No | `3000` | Server port |
| `API_PREFIX` | No | `api` | API route prefix |
| `DATABASE_URL` | **Yes** | - | MySQL connection string |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password (if required) |
| `JWT_ACCESS_SECRET` | **Yes** | - | JWT access token secret (32+ chars) |
| `JWT_REFRESH_SECRET` | **Yes** | - | JWT refresh token secret (32+ chars) |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry |
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | - | Google OAuth callback URL |
| `GITHUB_CLIENT_ID` | No | - | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | - | GitHub OAuth client secret |
| `GITHUB_CALLBACK_URL` | No | - | GitHub OAuth callback URL |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `BCRYPT_ROUNDS` | No | `12` | Bcrypt hashing rounds |
| `MFA_ISSUER` | No | `Aegis Platform` | MFA TOTP issuer name |

## Troubleshooting

### Database Connection Issues

```bash
# Check MySQL is running
mysql -u root -p

# Test connection
mysql -h localhost -u your_user -p your_database

# Verify DATABASE_URL format
DATABASE_URL="mysql://username:password@host:port/database"
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Start Redis (if not running)
redis-server

# Check Redis connection
redis-cli -h localhost -p 6379
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### TypeScript Compilation Errors

```bash
# Clean build
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

## Contributing

1. Follow TypeScript strict mode
2. Run linting before commit: `npm run lint`
3. Format code: `npm run format`
4. Write tests for new features
5. Follow API contract specifications exactly
6. Update documentation

## Support

For issues or questions, contact the development team.

## License

Proprietary - Aegis Platform © 2026
