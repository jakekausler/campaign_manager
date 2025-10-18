# TICKET-017: Frontend Project Setup - Implementation Plan

## Overview

Initialize the React frontend application with Vite, TypeScript, Tailwind CSS, Radix UI components, and complete development tooling.

## Stage 1: Initialize Vite + React + TypeScript Project ✅

**Goal**: Create basic Vite + React + TypeScript project structure within monorepo

**Tasks**:

- [x] Initialize Vite project in `packages/frontend/`
- [x] Configure package.json with correct workspace name `@campaign/frontend`
- [x] Set up TypeScript config extending monorepo base
- [x] Configure Vite for development and production builds
- [x] Add necessary dependencies (React, React DOM, TypeScript, Vite)
- [x] Create basic App.tsx and main.tsx entry points
- [x] Verify dev server runs and hot reload works

**Success Criteria**:

- ✅ Dev server starts successfully
- ✅ TypeScript compiles without errors
- ✅ Hot reload works on file changes

**Commit**: 5ce2b6f

## Stage 2: Configure Tailwind CSS + Radix UI

**Goal**: Set up styling system with Tailwind CSS and component library with Radix UI

**Tasks**:

- [ ] Install and configure Tailwind CSS with PostCSS
- [ ] Create tailwind.config.js with theme customization
- [ ] Set up Tailwind directives in main CSS file
- [ ] Install Radix UI primitives and dependencies
- [ ] Set up shadcn/ui CLI and configuration
- [ ] Initialize shadcn components (button, card, dialog, etc.)
- [ ] Create example components to verify styling works
- [ ] Verify Tailwind classes apply correctly

**Success Criteria**:

- Tailwind CSS classes work correctly
- Radix UI components render properly
- Theme colors and spacing work as expected

## Stage 3: Configure ESLint and Prettier

**Goal**: Set up code quality tools consistent with monorepo standards

**Tasks**:

- [ ] Configure ESLint for React + TypeScript
- [ ] Add React-specific linting rules (hooks, a11y)
- [ ] Configure Prettier for frontend package
- [ ] Add lint and format scripts to package.json
- [ ] Integrate with monorepo root linting/formatting
- [ ] Add lint-staged for pre-commit hooks
- [ ] Verify lint and format commands work

**Success Criteria**:

- ESLint runs without errors
- Prettier formats code consistently
- Pre-commit hooks work
- Follows monorepo conventions

## Stage 4: Create Folder Structure

**Goal**: Establish organized project structure following best practices

**Tasks**:

- [ ] Create `src/components/` directory with subdirectories (ui, features, layout)
- [ ] Create `src/pages/` directory for route components
- [ ] Create `src/hooks/` directory for custom React hooks
- [ ] Create `src/utils/` directory for helper functions
- [ ] Create `src/services/` directory for API clients
- [ ] Create `src/types/` directory for TypeScript types
- [ ] Create `src/lib/` directory for third-party integrations
- [ ] Add README.md files in key directories explaining structure
- [ ] Create barrel exports (index.ts) for clean imports

**Success Criteria**:

- All directories exist with proper organization
- Barrel exports work correctly
- Structure documented in README files

## Stage 5: Set Up Routing with React Router

**Goal**: Configure client-side routing with React Router v6

**Tasks**:

- [ ] Install React Router v6
- [ ] Create router configuration in `src/router/`
- [ ] Set up route definitions and lazy loading
- [ ] Create basic page components (Home, Login, Dashboard)
- [ ] Add layout components with navigation
- [ ] Configure 404 error page
- [ ] Set up protected routes (authentication wrapper)
- [ ] Add route-based code splitting
- [ ] Verify navigation between routes works

**Success Criteria**:

- Can navigate between routes
- Protected routes redirect correctly
- 404 page shows for invalid routes
- Code splitting reduces initial bundle size

## Stage 6: Configure Environment Variables

**Goal**: Set up environment variable management for different environments

**Tasks**:

- [ ] Create `.env.example` file with all required variables
- [ ] Create `.env.development` for local development
- [ ] Create `.env.production` for production builds
- [ ] Add environment variable types in `src/types/env.d.ts`
- [ ] Create environment config utility in `src/config/`
- [ ] Document environment variables in README
- [ ] Verify environment variables load correctly
- [ ] Add validation for required environment variables

**Success Criteria**:

- Environment variables load correctly in dev/prod
- TypeScript types enforce correct usage
- Missing required variables throw errors on startup

## Stage 7: Add Development Proxy for API

**Goal**: Configure Vite proxy to forward API requests to backend during development

**Tasks**:

- [ ] Configure Vite proxy in vite.config.ts
- [ ] Set up proxy rules for `/graphql` endpoint
- [ ] Configure proxy rules for `/api` REST endpoints (if any)
- [ ] Add WebSocket proxy for subscriptions
- [ ] Create API client service with base URL configuration
- [ ] Add CORS handling for development
- [ ] Test API requests work through proxy
- [ ] Document proxy configuration

**Success Criteria**:

- API requests proxy correctly to backend
- WebSocket connections work
- No CORS errors in development
- Production builds use direct API URLs

## Stage 8: Testing and Documentation

**Goal**: Verify all acceptance criteria and document the setup

**Tasks**:

- [ ] Run full build process and verify success
- [ ] Test dev server startup and hot reload
- [ ] Verify TypeScript compilation
- [ ] Test routing and navigation
- [ ] Verify environment variables work
- [ ] Test API proxy functionality
- [ ] Update main README.md with frontend setup instructions
- [ ] Update CLAUDE.md with frontend development guidelines
- [ ] Add frontend development section to documentation

**Success Criteria**:

- All acceptance criteria pass
- Documentation complete and accurate
- No TypeScript errors
- No linting errors

## Notes

- Use Vite 5.x for best performance
- React Router v6 for modern routing patterns
- Tailwind CSS v3.x with JIT mode
- Radix UI for accessible component primitives
- shadcn/ui for pre-built component library
- Follow monorepo conventions for all tooling
- Ensure hot reload works for optimal DX
