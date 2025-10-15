# TICKET-001: Project Scaffolding & Repository Setup

## Status

- [ ] Completed
- **Commits**:

## Description

Initialize the monorepo structure with all necessary services, establish coding standards, configure linting/formatting, and set up basic CI/CD pipeline configuration.

## Scope of Work

1. Create monorepo structure using pnpm workspaces
2. Initialize service directories:
   - `packages/api` - NestJS backend
   - `packages/rules-engine` - Node worker service
   - `packages/scheduler` - Node worker service
   - `packages/frontend` - React + Vite application
   - `packages/shared` - Shared TypeScript types and utilities
3. Configure root-level tooling:
   - TypeScript (strict mode, shared tsconfig.base.json)
   - ESLint with recommended configs
   - Prettier for formatting
   - Husky for git hooks (pre-commit, pre-push)
   - lint-staged
4. Set up pnpm workspace configuration in pnpm-workspace.yaml
5. Set up package.json scripts for:
   - Building all services
   - Running linters/formatters
   - Running tests across all packages
6. Configure GitHub Actions workflow for:
   - Linting and type checking
   - Running tests
   - Building all packages
7. Create basic README.md with:
   - Project overview
   - Setup instructions (using pnpm)
   - Development workflow
8. Initialize git repository with .gitignore (include .pnpm-store)

## Acceptance Criteria

- [ ] All service directories exist with package.json files
- [ ] TypeScript compiles successfully across all packages
- [ ] ESLint and Prettier run without errors
- [ ] Pre-commit hooks prevent commits with linting errors
- [ ] Root-level build script successfully builds all packages
- [ ] README contains clear setup instructions

## Technical Notes

- Use pnpm workspaces for dependency management (pnpm-workspace.yaml)
- Unified versioning strategy - all packages share the same version number
- Shared types should be in `packages/shared/src/types`
- Use path aliases (`@campaign/shared`, `@campaign/api`, etc.) configured in tsconfig
- pnpm advantages: faster installs, disk space efficiency, strict dependency resolution

### pnpm-workspace.yaml example:

```yaml
packages:
  - 'packages/*'
```

### Root package.json scripts example:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "type-check": "pnpm -r type-check"
  }
}
```

## Architectural Decisions

- **Monorepo vs Multi-repo**: Monorepo chosen for easier code sharing and coordinated changes
- **Workspace Manager**: Native pnpm workspaces (simpler, no extra tooling needed)
- **Package Manager**: pnpm for speed and efficiency
- **CI/CD**: GitHub Actions for automation
- **Versioning**: Unified versioning across all packages

## Dependencies

- None (this is the first ticket)

## Testing Requirements

- Verify that `pnpm install` works from root
- Verify that `pnpm run build` builds all packages
- Verify that `pnpm run lint` catches intentional errors
- Verify that git hooks prevent bad commits
- Verify that GitHub Actions workflow runs successfully

## Related Tickets

- Blocks: TICKET-002, TICKET-017

## Estimated Effort

1-2 days
