# CONTRIBUTING.md Research Findings

## 1. CODE STANDARDS AND CONVENTIONS

### TypeScript Configuration

- **Target**: ES2022
- **Module System**: commonjs
- **Strict Mode**: ENABLED (non-negotiable)
  - `strict: true` in tsconfig.base.json
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
  - `forceConsistentCasingInFileNames: true`
- **Node Version**: >=18.0.0
- **pnpm Version**: >=8.0.0

### ESLint Configuration (Root: .eslintrc.json)

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "plugins": ["@typescript-eslint", "import"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc" }
      }
    ]
  },
  "ignorePatterns": ["dist", "node_modules", "*.js", "*.config.ts", "vite.config.ts"]
}
```

**Key Rules**:

- Unused parameters allowed if prefixed with `_` (e.g., `_unused: string`)
- No explicit `any` types (warn level, not error)
- Import ordering: builtin → external → internal → parent → sibling → index
- Alphabetical ordering within groups
- No `any` type without explicit declaration

### Prettier Configuration (.prettierrc.json)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Key Standards**:

- Print width: 100 characters
- Single quotes (not double)
- Trailing commas in ES5-valid syntax
- 2 spaces indentation
- Always include parentheses around arrow function parameters
- Unix line endings (LF)

### Naming Conventions (from codebase analysis)

**Files**:

- Services: `*.service.ts` (e.g., `campaign.service.ts`, `auth.service.ts`)
- Controllers/Resolvers: `*.resolver.ts`, `*.controller.ts`
- DTOs: `*.dto.ts` (e.g., `register.dto.ts`)
- Utils: `*.util.ts`, `*.utils.ts`
- Types/Interfaces: `*.interface.ts` or in `.d.ts` files
- Tests: `*.test.ts`, `*.spec.ts`, `*.integration.test.ts`, `*.e2e.test.ts`

**Classes**:

- PascalCase (e.g., `CampaignService`, `UsersService`, `BranchResolver`)
- Service classes marked with `@Injectable()`
- Use descriptive names based on functionality

**Methods/Functions**:

- camelCase (e.g., `findById`, `canEdit`, `validatePassword`)
- Async methods use `async/await`

**Constants**:

- SCREAMING_SNAKE_CASE for true constants (e.g., `REDIS_PUBSUB`, `DATABASE_URL`)
- Use `as const` for TypeScript string literals

**Interfaces/Types**:

- PascalCase
- Prefix interfaces with `I` is optional (project doesn't mandate it)
- Prisma types imported as `Type as PrismaType` for clarity (e.g., `Branch as PrismaBranch`)

### Import Organization

Path aliases configured in tsconfig.base.json:

```
@campaign/shared → packages/shared/src
@campaign/api → packages/api/src
@campaign/rules-engine → packages/rules-engine/src
@campaign/scheduler → packages/scheduler/src
```

Always use path aliases, never relative imports for cross-package references.

### File Organization Patterns

**API Package Structure**:

```
packages/api/src/
├── database/          # Prisma service, migrations
├── auth/              # Authentication, users, password utilities
├── graphql/
│   ├── resolvers/     # GraphQL resolvers (*.resolver.ts)
│   ├── services/      # Business logic (*.service.ts)
│   ├── inputs/        # GraphQL input types
│   ├── context/       # GraphQL context
│   ├── pubsub/        # Pub/Sub setup
│   └── utils/         # Utility functions
├── rules/             # Rules engine integration
├── websocket/         # WebSocket gateway
├── common/            # Health checks, caching, spatial
├── @types/            # Custom type definitions
├── main.ts            # Entry point
└── app.module.ts      # Root module
```

**Frontend Package Structure**:

```
packages/frontend/src/
├── components/        # React components
│   ├── features/      # Feature components
│   └── ui/            # UI components
├── pages/             # Page components
├── hooks/             # Custom React hooks
├── stores/            # Zustand state slices
├── services/          # API services
├── utils/             # Utility functions
├── types/             # TypeScript types
├── __tests__/         # Test setup and utilities
└── __generated__/     # GraphQL generated code
```

### Documentation Patterns

**File Headers** (from codebase):

```typescript
/**
 * Campaign Service
 * Business logic for Campaign operations
 * Implements CRUD with soft delete, archive, and cascade delete to child entities
 */

/**
 * Branch Resolver Integration Tests
 * E2E tests for Branch GraphQL queries and mutations
 */

/**
 * GeoJSON type definitions for spatial data
 * Based on RFC 7946: https://tools.ietf.org/html/rfc7946
 */
```

**Method/Function Documentation**:

```typescript
/**
 * Find campaign by ID
 * Ensures user has access to the campaign
 */
async findById(id: string, user: AuthenticatedUser): Promise<PrismaCampaign | null>
```

---

## 2. TESTING PATTERNS

### Testing Frameworks

- **Backend**: Jest (configured via jest.config.js in each package)
- **Frontend**: Vitest (configured via vite.config.ts)
- **Integration Tests**: Real database (PostgreSQL + PostGIS)
- **Mocking**: MSW (Mock Service Worker) for frontend, jest.fn() for backend

### Test File Naming

**Backend**:

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`
- Performance tests: `*.performance.test.ts`

**Frontend**:

- Unit tests: `*.test.ts`
- Performance tests: `__performance__/*.performance.test.ts`
- Excluded from default runs to prevent memory issues

### Jest Configuration Example (packages/api/jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  testTimeout: 30000, // 30 second timeout
  maxWorkers: 1, // Serial execution for database consistency
  moduleNameMapper: { '^@campaign/shared$': '<rootDir>/../shared/src' },
};
```

**Key Settings**:

- `testEnvironment: 'node'` for backend
- `maxWorkers: 1` for database consistency in integration tests
- 30-second timeout for slow tests
- Coverage collected excluding test files

### Test Patterns

**Backend Unit Test (from users.service.test.ts)**:

```typescript
describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      // ...
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new user', async () => {
    const userData = { email: 'test@example.com', password: 'hashedPassword', name: 'Test User' };
    const expectedUser = { id: '1', ...userData };

    mockPrismaService.user.create.mockResolvedValue(expectedUser);

    const result = await service.create(userData);
    expect(result).toEqual(expectedUser);
  });
});
```

**Backend Integration Test (from branch.resolver.integration.test.ts)**:

```typescript
describe('BranchResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: BranchResolver;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchResolver,
        BranchService,
        VersionService,
        AuditService,
        PrismaService,
        // ... mocked services
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests...
});
```

**Frontend Unit Test (from geometry.test.ts)**:

```typescript
import { afterEach, describe, it, expect, vi } from 'vitest';
import { calculatePolygonArea } from './geometry';

afterEach(() => {
  vi.clearAllMocks();
});

describe('calculatePolygonArea', () => {
  describe('valid polygons', () => {
    it('should calculate area for a simple square polygon', () => {
      const coordinates: number[][] = [
        [0, 0],
        [0.009, 0],
        [0.009, 0.009],
        [0, 0.009],
        [0, 0],
      ];

      const area = calculatePolygonArea(coordinates);

      expect(area).toBeGreaterThan(900000);
      expect(area).toBeLessThan(1100000);
    });
  });
});
```

### Testing Best Practices (from CLAUDE.md)

1. Test behavior, not implementation
2. One assertion per test when possible
3. Clear test names describing the scenario
4. Use existing test utilities and helpers
5. Tests must be deterministic
6. Coverage expected but not enforced (team judgment)
7. Use type mocking for NestJS services
8. Integration tests use real database with migrations
9. MSW for API mocking in frontend tests
10. Performance tests run separately (memory-conscious)

### Test Timeout Configuration

- Backend (Jest): 30 seconds
- Frontend (Vitest): 15 seconds
- Hook timeout: 15 seconds

---

## 3. GIT/BRANCH WORKFLOW

### Commit Message Format (Conventional Commits)

**Structure**:

```
<type>(<scope>): <short summary>

<detailed body explaining WHY, implementation decisions, context>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Commit Types**:

- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes only
- `refactor` - Code changes that neither fix bugs nor add features
- `test` - Adding or updating tests
- `chore` - Changes to build process, dependencies, or tooling
- `perf` - Performance improvements
- `style` - Code style changes (formatting, missing semicolons, etc.)

**Scopes** (from codebase):

- `api` - Changes to @campaign/api
- `frontend` - Changes to @campaign/frontend
- `shared` - Changes to @campaign/shared
- `rules-engine` - Changes to @campaign/rules-engine
- `scheduler` - Changes to @campaign/scheduler
- `root` - Changes to root-level config or multiple packages
- `plan` - Changes to project planning documents
- `packages` - Package documentation and metadata
- `database` - Database schema and migrations
- `user-guide` - User-facing documentation

**Recent Commit Examples**:

```
docs(plan): mark TICKET-035 Stage 3 as complete
docs(user-guide): add screenshot/diagram placeholders to enhance visual learning
fix(api): resolve null-safety issues in seed script and improve polymorphic error handling
fix(api): remove Link model foreign key constraints for polymorphic relationships
feat(api): implement cache monitoring and statistics system
docs(packages): create and enhance package READMEs with comprehensive documentation linking
```

**Key Rules**:

- Summary line: <72 chars, imperative mood, no period
- Body: Explain WHY, not just WHAT. Include implementation decisions and ticket references
- Always include Claude Code attribution footer
- Use HEREDOC for multi-line messages (see example in CLAUDE.md)

### Branch Strategy

- Main branch: `main`
- Develop branch: `develop` (from CI config)
- No specific branch naming conventions documented

---

## 4. DEVELOPMENT WORKFLOW

### Pre-Commit Hooks (Husky)

**Hook Location**: `.husky/pre-commit`

**Hook Behavior**:

1. Run `pnpm run format:check` - Verify formatting with Prettier
2. Run `pnpm run lint` - Run ESLint checks
3. Run `pnpm exec lint-staged` - Auto-fix staged files (_.ts/_.tsx for eslint+prettier)

**Lint-Staged Config** (.lintstagedrc.json):

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

### CI/CD Pipeline (.github/workflows/ci.yml)

**Jobs**:

1. **Lint and Type Check**
   - Prettier format check
   - ESLint linting
   - TypeScript type-check (pnpm run type-check)
2. **Test Backend**
   - PostgreSQL + PostGIS container
   - Redis container
   - Run migrations
   - Test: api, rules-engine, scheduler, shared
3. **Test Frontend**
   - Category-based execution (prevents OOM)
   - Sequential test runs with memory limits
   - Performance regression tests (separate)
4. **Performance**
   - Runs performance benchmarks for rules-engine
   - Acceptance criteria: p95 < 50ms (eval), < 5ms (cached), 100+ concurrent
5. **Build All Packages**
   - Verify all packages build successfully

**Key CI Details**:

- Runs on: Ubuntu latest
- Node: 18.x
- pnpm: 10.x
- Frozen lockfile required
- Tests run with PostgreSQL + Redis services
- Frontend tests run sequentially to prevent memory issues

### Quality Gates (Pre-Commit)

Must pass before commit:

- Prettier format check
- ESLint linting
- Auto-fixes applied to staged files

All pushed code must also pass CI (type-check, lint, tests, build).

### Running Quality Checks Locally

```bash
# Type-check
pnpm run type-check

# Lint check
pnpm run lint

# Format check
pnpm run format:check

# Auto-fix
pnpm run lint -- --fix
pnpm run format

# Run all
pnpm run type-check && pnpm run lint && pnpm run test
```

---

## 5. MONOREPO SPECIFICS

### Packages

- `@campaign/shared` - Shared types and utilities
- `@campaign/api` - NestJS GraphQL API
- `@campaign/rules-engine` - Rules evaluation worker
- `@campaign/scheduler` - Event scheduling worker
- `@campaign/frontend` - React web application

### Commands

- Never use `cd` to navigate between packages
- Always use `pnpm --filter @campaign/<package>` for package-specific commands
- Root commands run across all packages using `pnpm -r`

### Examples

```bash
# All packages
pnpm run build
pnpm run test
pnpm run lint

# Specific package
pnpm --filter @campaign/api build
pnpm --filter @campaign/api test
pnpm --filter @campaign/frontend dev
```

---

## 6. ADDITIONAL PATTERNS

### Error Handling

- Use NestJS HttpException subclasses (ForbiddenException, BadRequestException, etc.)
- Include descriptive error messages
- Handle errors at appropriate level (don't silently swallow)

### Async Code

- Use async/await (not .then() chains)
- Mark async functions explicitly
- Handle promise rejections

### Type Safety

- Avoid `any` type (warn level in ESLint)
- Use `unknown` if needed, not `any`
- Import types with `import type { ... }`
- Explicitly annotate return types when helpful

### Code Documentation

- Block comments for file/class headers
- JSDoc comments for public methods
- Explain complex logic inline
- Include examples in type comments

### Performance Considerations

- Frontend tests run with memory limits (6GB max heap)
- Backend integration tests run serially (database consistency)
- Performance tests excluded from default runs
- Use connection pooling for database
- Redis for caching and pub/sub
