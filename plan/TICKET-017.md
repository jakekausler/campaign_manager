# TICKET-017: Frontend Project Setup (React + Vite)

## Status

- [ ] In Progress
- **Commits**:
  - 5ce2b6f - Stage 1: Initialize Vite + React + TypeScript
  - 0d8b80c - Stage 2: Configure Tailwind CSS + Radix UI
  - b0fbd94 - Stage 3: Configure ESLint and Prettier
  - fc7991e - Stage 4: Create Folder Structure

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

---

### Stage 2: Configure Tailwind CSS + Radix UI (Completed)

**Changes Made**:

Configuration Files:

- Created `tailwind.config.js` with custom theme configuration
  - HSL-based color system for easy theme customization
  - Support for dark mode via CSS class strategy
  - Extended theme with custom animations for accordion components
  - Configured content paths for Tailwind JIT compilation
  - Added `tailwindcss-animate` plugin for smooth animations
- Created `postcss.config.js` with Tailwind and Autoprefixer plugins
- Created `src/index.css` with Tailwind directives and CSS variable definitions
  - Complete color palette for light/dark themes using HSL format
  - Custom border-radius system using CSS variables
  - Base styles for consistent typography and borders
- Updated `src/main.tsx` to import the main CSS file

Utility Functions:

- Created `src/lib/utils.ts` with `cn()` helper function
  - Merges Tailwind classes using `clsx` and `tailwind-merge`
  - Enables conditional styling and proper class deduplication

shadcn/ui Components:

- Created `src/components/ui/button.tsx`
  - 6 variants: default, destructive, outline, secondary, ghost, link
  - 4 size options: default, sm, lg, icon
  - Uses `class-variance-authority` for type-safe variant props
  - Supports `asChild` prop via Radix UI Slot primitive
- Created `src/components/ui/card.tsx`
  - Complete card component system: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
  - Proper TypeScript types with forwardRef support
- Created `src/components/ui/dialog.tsx`
  - Full-featured dialog with overlay, animations, and accessibility
  - Uses Radix UI Dialog primitive
  - Includes close button with Lucide icon
  - Portal-based rendering for proper z-index management
- Created `src/components/ui/index.ts` for barrel exports

Example Implementation:

- Updated `src/App.tsx` to showcase all components
  - Responsive grid layout with 4 example cards
  - Counter example testing hot reload and state management
  - Button variants showcase demonstrating all 6 styles
  - Interactive dialog example with proper accessibility
  - Tailwind utilities showcase with theme colors

**Dependencies Added**:

- `tailwindcss@^3.4.18`, `postcss@^8.4.49`, `autoprefixer@^10.4.20`
- `tailwindcss-animate@^1.0.7`
- `class-variance-authority@^0.7.1`, `clsx@^2.1.1`, `tailwind-merge@^2.6.0`
- `@radix-ui/react-slot@^1.1.1`, `@radix-ui/react-dialog@^1.1.4`, `@radix-ui/react-label@^2.1.1`
- `lucide-react@^0.469.0`

**Technical Decisions**:

- Used Tailwind CSS v3.4.18 instead of v4 for compatibility with standard shadcn/ui patterns and PostCSS configuration
- Chose HSL color format for theme variables to enable easy color manipulation and accessibility improvements
- Implemented Radix UI primitives for accessible, unstyled base components following WAI-ARIA patterns
- Used `class-variance-authority` for type-safe variant management with IntelliSense support
- Created manual shadcn/ui components instead of using CLI to maintain monorepo compatibility
- Configured dark mode support via class strategy for future implementation

**Success Verification**:
✅ Dev server starts successfully with Tailwind CSS processing
✅ TypeScript compiles without errors
✅ ESLint passes with no warnings (auto-fixed import ordering)
✅ All UI components render correctly with proper styling
✅ Tailwind classes apply correctly with JIT compilation
✅ Radix UI Dialog works with animations and accessibility features
✅ Hot reload works seamlessly with CSS and component changes
✅ Button variants display correctly with all 6 styles
✅ Card components layout properly with responsive grid

**Next Steps**: Stage 3 will configure ESLint and Prettier for the frontend package.

---

### Stage 3: Configure ESLint and Prettier (Completed)

**Changes Made**:

ESLint Configuration:

- Added `eslint-plugin-jsx-a11y@^6.10.2` for automated accessibility checks
- Enhanced `.eslintrc.json` with:
  - `plugin:jsx-a11y/recommended` ruleset for comprehensive accessibility validation
  - `react/prop-types: off` (using TypeScript for type checking instead)
  - `react-hooks/rules-of-hooks: error` (enforce React Hooks rules)
  - `react-hooks/exhaustive-deps: warn` (warn on missing effect dependencies)
  - `jsx-a11y/anchor-is-valid` configured for React Router Link component
- Maintains inheritance from root ESLint config for monorepo consistency

Prettier Configuration:

- Added `format` script: `prettier --write "src/**/*.{ts,tsx,css}"`
- Added `format:check` script: `prettier --check "src/**/*.{ts,tsx,css}"`
- Uses root `.prettierrc.json` configuration (semi, single quotes, 100 char width, etc.)
- Scripts alphabetically ordered in package.json for consistency

Bug Fixes:

- Fixed `CardTitle` component in `src/components/ui/card.tsx`:
  - Changed `React.forwardRef` generic type from `HTMLParagraphElement` to `HTMLHeadingElement`
  - Explicitly destructured and rendered `children` prop within `<h3>` element
  - Resolves `jsx-a11y/heading-has-content` accessibility error

**Technical Decisions**:

- Used `jsx-a11y/recommended` preset for industry-standard accessibility validation
- Kept `prop-types` rule disabled since TypeScript provides superior type safety
- Set `exhaustive-deps` to "warn" instead of "error" to allow flexibility for experienced developers
- Configured `jsx-a11y/anchor-is-valid` to recognize React Router's `Link` component with `to` prop
- Target only relevant file extensions (ts, tsx, css) in format scripts for optimal performance

**Success Verification**:
✅ TypeScript compiles without errors
✅ ESLint passes with all accessibility checks enabled (0 errors, 0 warnings)
✅ Prettier formatting is consistent across all source files
✅ All quality scripts work correctly (lint, format, format:check, type-check)
✅ Pre-commit hooks successfully validate code quality
✅ CardTitle component properly handles children for screen readers

**Next Steps**: Stage 4 will create the organized folder structure for components, pages, hooks, utils, and services.

---

### Stage 4: Create Folder Structure (Completed)

**Changes Made**:

Directory Structure:

- Created `src/components/` subdirectories: `features/`, `layout/` (ui/ already existed)
- Created `src/pages/` for route components
- Created `src/hooks/` for custom React hooks
- Created `src/utils/` for pure utility functions
- Created `src/services/` for API clients and integrations
- Created `src/types/` for TypeScript type definitions

Documentation (7 README files):

- `src/components/README.md` - Explains ui/features/layout organization, usage patterns, and guidelines
- `src/pages/README.md` - Documents page component structure, routing patterns, and conventions
- `src/hooks/README.md` - Covers custom hook naming conventions, structure, and best practices
- `src/utils/README.md` - Defines pure utility functions, guidelines, and utils vs hooks distinction
- `src/services/README.md` - Explains API clients, GraphQL integration, and service patterns
- `src/types/README.md` - Documents type definitions, type vs interface usage, and generation strategies
- `src/lib/README.md` - Covers third-party library configurations and lib vs utils distinction

Barrel Exports (8 index.ts files):

- `src/components/features/index.ts` - Barrel export for feature components
- `src/components/layout/index.ts` - Barrel export for layout components
- `src/pages/index.ts` - Barrel export for page components
- `src/hooks/index.ts` - Barrel export for custom hooks
- `src/utils/index.ts` - Barrel export for utility functions
- `src/services/index.ts` - Barrel export for service modules
- `src/types/index.ts` - Barrel export for TypeScript types
- `src/lib/index.ts` - Barrel export for library integrations (exports existing cn() utility)

**Technical Decisions**:

- Separated components into ui (primitives), features (business logic), and layout (structure) for clear separation of concerns
- Distinguished lib (third-party integrations) from utils (pure application functions) to maintain clear boundaries
- Created comprehensive README files with examples, guidelines, and comparisons to reduce confusion
- Used JSDoc comments in barrel exports with commented examples for future reference
- Followed monorepo path alias conventions (@/components, @/hooks, etc.)
- Prepared structure for future additions without adding unnecessary placeholder files

**Documentation Highlights**:

- Each README includes Purpose, Structure, Usage, Guidelines, and Examples sections
- Comparison sections clarify distinctions (lib vs utils, utils vs hooks, features vs ui)
- Code examples demonstrate realistic usage patterns matching the planned architecture
- Guidelines emphasize TypeScript best practices, accessibility, and project conventions

**Success Verification**:
✅ All directories created with proper organization
✅ 7 comprehensive README files documenting each directory's purpose
✅ 8 barrel export files enabling clean imports with path aliases
✅ TypeScript compiles without errors (verified via TypeScript Fixer)
✅ ESLint passes with no warnings (verified via TypeScript Fixer)
✅ Code review approved with no issues found
✅ Consistent patterns across all directories
✅ Structure aligns with React and TypeScript best practices

**Next Steps**: Stage 5 will set up routing with React Router v6 for client-side navigation.
