# Aegis Platform - Frontend

Enterprise AI Multi-Agent SaaS Platform with OpenClaw-per-Company isolation.

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4+
- **Components**: Radix UI + shadcn/ui
- **State Management**: React Query (server state) + Zustand (client state)
- **Forms**: React Hook Form + Zod validation
- **API Client**: Axios with interceptors
- **Icons**: Lucide React

## Design System

- **Primary Color**: Deep Indigo (#6366f1)
- **Fonts**: Inter (UI) + JetBrains Mono (code)
- **Aesthetic**: Linear/Vercel - clean, minimal, high contrast
- **Accessibility**: WCAG 2.1 AA compliant

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:3000

### Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Setup environment variables:**

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration.

3. **Run development server:**

```bash
npm run dev
```

The app will be available at [http://localhost:3001](http://localhost:3001)

### Available Scripts

- `npm run dev` - Start development server on port 3001
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript compiler checks

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Auth routes
│   │   ├── admin/             # Platform admin routes
│   │   └── dashboard/         # Tenant routes
│   ├── components/            # React components
│   ├── lib/                   # Utilities, API, stores
│   ├── styles/                # Global styles
│   └── types/                 # TypeScript types
├── public/                    # Static assets
└── Configuration files
```

## Development Workflow

- Use Tailwind utility classes for styling
- Follow TypeScript strict mode (no `any` types)
- API client handles authentication automatically
- State managed with Zustand (client) + React Query (server)

## Building for Production

```bash
npm run build
npm run start
```

## Sprint Roadmap

- ✅ Sprint 1 (Weeks 1-2): Project foundation
- Sprints 2-6: Backend implementation
- Sprints 7-8 (Weeks 13-16): Frontend screens
- Sprint 9 (Weeks 17-18): Integration & polish

## Support

Refer to:

- **API Contract**: `docs/api-contract.md`
- **Design Specs**: `design-artifacts/styled-dsl.yaml`
- **Phase 3 Context**: `docs/phase-3-context.md`

---

**Aegis Platform v1.0.0** - Built with Next.js 15, TypeScript, and Tailwind CSS
