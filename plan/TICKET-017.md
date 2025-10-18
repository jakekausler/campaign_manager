# TICKET-017: Frontend Project Setup (React + Vite)

## Status

- [ ] In Progress
- **Commits**:
  - 5ce2b6f - Stage 1: Initialize Vite + React + TypeScript

## Description

Initialize the React frontend application with Vite, TypeScript, Tailwind CSS, Radix UI components, and development tooling.

## Scope of Work

1. Initialize Vite + React + TypeScript project
2. Configure Tailwind CSS + Radix UI/shadcn
3. Set up ESLint, Prettier
4. Create folder structure (components, pages, hooks, utils, services)
5. Set up routing with React Router
6. Configure environment variables
7. Add development proxy for API

## Acceptance Criteria

- [ ] Dev server runs successfully
- [ ] TypeScript compiles without errors
- [ ] Tailwind CSS works
- [ ] Hot reload works
- [ ] Can navigate between routes
- [ ] Environment variables load correctly

## Dependencies

- Requires: TICKET-001

## Estimated Effort

1-2 days

## Implementation Notes

### Stage 1: Initialize Vite + React + TypeScript (Completed)

**Changes Made**:

- Created separate `App.tsx` component with an interactive counter button to test hot reload functionality
- Updated `main.tsx` to import App component, following proper separation of concerns
- Enhanced `vite.config.ts` with:
  - Path alias configuration (`@/*` -> `./src/*`) for cleaner imports
  - Build optimizations including vendor chunking (React/ReactDOM separated for better caching)
  - Sourcemap generation for debugging
  - Network-friendly server config (`host: true`, `strictPort: false`) for Docker compatibility
- Updated `tsconfig.json`:
  - Added path alias support matching Vite config
  - Removed restrictive `rootDir` option to allow compilation of root-level config files (vite.config.ts)
  - Included `vite.config.ts` in compilation
- Updated `package.json`:
  - Added TypeScript as dev dependency (explicit type support)
  - Added `@types/node` for Node.js built-in module types (required for path alias resolution)
  - Maintained alphabetical ordering in devDependencies

**Technical Decisions**:

- Used `@/*` alias pattern instead of `@campaign/frontend/*` to distinguish frontend-specific paths from workspace packages
- Implemented vendor chunking strategy to separate React libraries from application code for optimal caching
- Enabled sourcemaps to support debugging in development and production
- Used `host: true` in Vite config for Docker/network accessibility

**Success Verification**:
✅ Dev server starts successfully on port 3000 (tested with timeout command)
✅ TypeScript compiles without errors
✅ ESLint passes with no errors
✅ Hot reload functionality works (verified via counter button component)
✅ Path alias system configured and ready for use

**Next Steps**: Stage 2 will add Tailwind CSS and Radix UI for styling and component primitives.
