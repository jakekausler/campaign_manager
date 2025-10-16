# Campaign Management Tool

A full-stack campaign management tool for tabletop RPGs that unifies map, flowchart, and timeline views around shared domain objects (locations, encounters, events, characters). The system supports temporal versioning (history), branching (what-if scenarios), and conditional availability via a rules engine.

## Features

- **Multi-View System**: Integrated map, flowchart, and timeline views
- **Spatial Data**: PostGIS-powered location and geography management
- **Party & Kingdom Management**: Support for multiple parties, kingdoms, settlements, and structures with level tracking
- **Typed Variables**: Define custom typed variables (string, number, boolean, enum) for all entity types
- **Level History**: Track level changes across all entities with comprehensive audit trail
- **Campaign Context**: Aggregate party, kingdom, settlement, and structure state for rules engine
- **Rules Engine**: JSONLogic-based conditional system for dynamic content
- **Versioning**: Full history tracking and branching support
- **Real-time Updates**: WebSocket-based synchronization
- **Event Scheduling**: Cron-based automated event processing

## Tech Stack

### Backend

- **NestJS** - GraphQL API framework
- **Node Workers** - Rules engine and scheduler services
- **PostgreSQL** - Primary database
- **PostGIS** - Spatial data extension
- **Redis** - Caching and pub/sub
- **MinIO** - S3-compatible object storage

### Frontend

- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **MapLibre** - Map rendering
- **React Flow** - Flowchart visualization

### DevOps

- **Docker Compose** - Local development and deployment
- **pnpm** - Fast, efficient package manager
- **GitHub Actions** - CI/CD pipeline

## Project Structure

```
campaign_manager/
├── packages/
│   ├── api/              # NestJS GraphQL API
│   ├── rules-engine/     # Rules evaluation worker
│   ├── scheduler/        # Event scheduling worker
│   ├── frontend/         # React web application
│   └── shared/           # Shared types and utilities
├── .github/
│   └── workflows/        # CI/CD workflows
├── plan/                 # Project planning documents
├── pnpm-workspace.yaml   # Workspace configuration
└── package.json          # Root package configuration
```

## Getting Started

### Prerequisites

#### Option 1: Docker (Recommended)

- **Docker** >= 24.0.0
- **Docker Compose** >= 2.20.0

#### Option 2: Local Development

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **PostgreSQL** >= 14 with PostGIS extension
- **Redis** >= 7.0
- **MinIO** or S3-compatible storage

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

### Installation (Docker - Recommended)

1. Clone the repository:

```bash
git clone <repository-url>
cd campaign_manager
```

2. Copy the environment file:

```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your configuration (optional for local development)

4. Start all services:

```bash
# Development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

5. Access the application:

- **Frontend**: http://localhost:5173 (dev) or http://localhost:8080 (prod)
- **API/GraphQL**: http://localhost:3000
- **GraphQL Playground**: http://localhost:3000/graphql (dev only)
- **MinIO Console**: http://localhost:9001

6. Stop all services:

```bash
docker-compose down
```

7. Clean up volumes (removes all data):

```bash
docker-compose down -v
```

### Installation (Local Development)

1. Clone the repository:

```bash
git clone <repository-url>
cd campaign_manager
```

2. Install dependencies:

```bash
pnpm install
```

3. Initialize Husky git hooks:

```bash
pnpm run prepare
```

### Development

Run all services in development mode:

```bash
pnpm run dev
```

Run a specific package:

```bash
pnpm --filter @campaign/api dev
pnpm --filter @campaign/frontend dev
```

### Building

Build all packages:

```bash
pnpm run build
```

Build a specific package:

```bash
pnpm --filter @campaign/api build
```

### Testing

Run all tests:

```bash
pnpm run test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```

### Code Quality

Run linters:

```bash
pnpm run lint
```

Format code:

```bash
pnpm run format
```

Check formatting:

```bash
pnpm run format:check
```

Type checking:

```bash
pnpm run type-check
```

### Clean Build Artifacts

Remove all build artifacts and dependencies:

```bash
pnpm run clean
```

## Development Workflow

### Git Hooks

This project uses Husky to enforce code quality:

- **pre-commit**: Runs lint-staged to lint and format changed files
- **pre-push**: Runs type checking and tests before pushing

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Recommended rules with TypeScript support
- **Prettier**: Consistent code formatting
- **Import ordering**: Alphabetically sorted with grouping

### Commit Messages

Follow conventional commit format:

```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Monorepo Structure

This project uses pnpm workspaces for monorepo management.

### Workspace Commands

Install a dependency in a specific package:

```bash
pnpm --filter @campaign/api add <package>
```

Run a command in all packages:

```bash
pnpm -r <command>
```

Run a command in all packages in parallel:

```bash
pnpm -r --parallel <command>
```

### Path Aliases

TypeScript path aliases are configured for easy imports:

- `@campaign/shared` - Shared types and utilities
- `@campaign/api` - API package
- `@campaign/rules-engine` - Rules engine package
- `@campaign/scheduler` - Scheduler package

## CI/CD

GitHub Actions workflow runs on every push and pull request:

1. **Lint and Type Check** - Ensures code quality
2. **Tests** - Runs all test suites
3. **Build** - Verifies all packages build successfully

## Architecture

```
┌─────────────┐
│   Frontend  │
│  (React +   │
│    Vite)    │
└──────┬──────┘
       │
       ├── GraphQL
       │
┌──────▼──────┐     ┌──────────────┐
│  API Server │────▶│ PostgreSQL + │
│  (NestJS)   │     │   PostGIS    │
└──────┬──────┘     └──────────────┘
       │
       ├── Redis
       │
┌──────▼──────────┬──────────────┐
│  Rules Engine   │  Scheduler   │
│   Worker        │   Worker     │
└─────────────────┴──────────────┘
       │
┌──────▼──────┐
│    MinIO    │
│  (Storage)  │
└─────────────┘
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass and code is formatted
4. Submit a pull request

## License

MIT

## Project Status

This project is currently in active development. See the `plan/` directory for detailed tickets and roadmap.

### Completed Features

**Core Entity Management**

- [x] TICKET-001: Project Scaffolding & Repository Setup
- [x] TICKET-002: Docker Compose Infrastructure
- [x] TICKET-003: Database Schema Design & Prisma Setup
- [x] TICKET-004: Authentication & Authorization System
- [x] TICKET-005: Basic GraphQL API with NestJS
- [x] TICKET-006: Entity CRUD Operations (Campaigns, Locations, Characters, Encounters, Events)
- [x] TICKET-007: Audit System & Event Publishing
- [x] TICKET-008: Versioning System
- [x] TICKET-009: Party & Kingdom Management

**Party & Kingdom Management (TICKET-009)**

- Support for multiple parties per campaign
- Kingdom, Settlement, and Structure hierarchies
- Level tracking with validation and history
- Typed custom variables (string, number, boolean, enum)
- Campaign context aggregation for rules engine
- Comprehensive GraphQL API for all operations

See `plan/EPIC.md` for the complete project roadmap and upcoming features.
