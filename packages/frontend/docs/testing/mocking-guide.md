# Frontend Test Mocking Guide

**Last Updated:** 2025-11-04
**Related:** [Test Memory Mitigation Plan](../../../../docs/development/test-memory-mitigation-plan.md)

---

## Overview

This guide provides patterns and best practices for mocking heavy dependencies in frontend tests. Proper mocking reduces memory consumption, speeds up test execution, and creates more reliable unit tests that focus on component logic rather than dependency behavior.

**Key Benefits:**

- **Memory Reduction**: 100-150MB savings from React Flow mocking alone
- **Faster Tests**: Avoiding WebGL/Canvas initialization and complex library setup
- **Isolation**: Test component logic without dependency side effects
- **Reliability**: Eliminate flaky tests from timing-dependent rendering

---

## Table of Contents

1. [When to Mock Heavy Dependencies](#when-to-mock-heavy-dependencies)
2. [React Flow](#react-flow)
3. [MapLibre GL](#maplibre-gl)
4. [Turf.js](#turfjs)
5. [Memory Profiling](#memory-profiling)
6. [GeoJSON Fixtures](#geojson-fixtures)
7. [Apollo Client](#apollo-client)
8. [Best Practices](#best-practices)

---

## When to Mock Heavy Dependencies

### General Guidelines

**Mock when:**

- Testing component logic, state management, or UI interactions
- Testing event handlers and user interactions
- Testing data transformations and business logic
- Memory consumption is a concern
- Test speed is a priority

**Don't mock when:**

- Testing actual rendering output (use E2E tests instead)
- Testing integration between multiple systems
- Testing library-specific behavior (e.g., layout algorithms, spatial calculations)
- Mocking would make the test meaningless

### Decision Matrix

| Test Type            | React Flow      | MapLibre GL     | Turf.js         | Apollo Client   |
| -------------------- | --------------- | --------------- | --------------- | --------------- |
| **Unit Test**        | ✅ Mock         | ✅ Mock         | ⚠️ Case by case | ✅ Mock (MSW)   |
| **Integration**      | ⚠️ Case by case | ⚠️ Case by case | ❌ Real         | ⚠️ Case by case |
| **E2E (Playwright)** | ❌ Real         | ❌ Real         | ❌ Real         | ❌ Real         |

---

## React Flow

### When to Mock

✅ **Mock React Flow when:**

- Testing component logic that uses flow nodes/edges
- Testing state management (e.g., Zustand stores that manage flow data)
- Testing UI interactions (buttons, dialogs, panels)
- Testing event handlers (click, select, drag start/end)
- Testing data transformations (converting campaign data to flow nodes)

❌ **Don't mock when:**

- Testing actual flow rendering and layout algorithms
- Testing React Flow's viewport controls (zoom, pan)
- Visual regression testing

### Usage

**Standard Pattern:**

```typescript
import { describe, it, expect, vi } from 'vitest';

// Phase 1 (Mitigation Plan) Task 1.2: Mock React Flow to reduce memory usage
vi.mock('@xyflow/react', async () => {
  const mocks = await import('@/__tests__/mocks/react-flow');
  return mocks.createReactFlowMock();
});

describe('MyFlowComponent', () => {
  it('should handle node selection', () => {
    // Test component logic with mocked React Flow
  });
});
```

### Available Mock Components

The React Flow mock (`src/__tests__/mocks/react-flow.tsx`) provides:

**Components:**

- `ReactFlow` - Main flow component (renders children only)
- `Background` - Grid/dots background (no-op)
- `Controls` - Zoom/pan controls (no-op)
- `MiniMap` - Overview minimap (no-op)
- `Panel` - Overlay panel (renders children)
- Custom edges: `BaseEdge`, `BezierEdge`, `SmoothStepEdge`, `StepEdge`, `StraightEdge`

**Hooks:**

- `useReactFlow()` - Returns mock flow instance with common methods
- `useNodesState(initial)` - Returns `[nodes, setNodes, onNodesChange]`
- `useEdgesState(initial)` - Returns `[edges, setEdges, onEdgesChange]`
- `useNodes()` - Returns current nodes
- `useEdges()` - Returns current edges

**Utilities:**

- `addEdge(connection, edges)` - Adds edge to array
- `applyNodeChanges(changes, nodes)` - Applies node changes
- `applyEdgeChanges(changes, edges)` - Applies edge changes

### Example: Testing Flow Component Logic

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowViewPage } from './FlowViewPage';

vi.mock('@xyflow/react', async () => {
  const mocks = await import('@/__tests__/mocks/react-flow');
  return mocks.createReactFlowMock();
});

describe('FlowViewPage', () => {
  it('should render flow controls', () => {
    render(<FlowViewPage />);

    // Test that controls are rendered (mocked component)
    expect(screen.getByTestId('flow-controls')).toBeInTheDocument();
  });

  it('should handle node selection via state', () => {
    const { container } = render(<FlowViewPage />);

    // Test state management logic, not actual React Flow rendering
    // The mock allows testing component logic without WebGL overhead
  });
});
```

### Memory Impact

- **Without mocking**: ~100-150MB per test file (WebGL contexts, canvas rendering)
- **With mocking**: ~5-10MB per test file (DOM-only rendering)

---

## MapLibre GL

### When to Mock

✅ **Mock MapLibre GL when:**

- Testing map controls and UI interactions
- Testing data loading and GeoJSON processing
- Testing event handlers (click, hover, layer interactions)
- Testing camera position and viewport logic

❌ **Don't mock when:**

- Testing actual tile rendering
- Testing map styling and visualization
- Testing real geographic calculations (use Turf.js instead)

### Usage

**Standard Pattern:**

```typescript
import { describe, it, vi } from 'vitest';

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    addSource: vi.fn(),
    removeSource: vi.fn(),
    getSource: vi.fn(),
    setStyle: vi.fn(),
    flyTo: vi.fn(),
    remove: vi.fn(),
  })),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
  Popup: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
}));
```

### Example: Testing Map Controls

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MapControls } from './MapControls';

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    flyTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

describe('MapControls', () => {
  it('should trigger flyTo when location is selected', () => {
    const mockFlyTo = vi.fn();
    const mockMap = { flyTo: mockFlyTo };

    render(<MapControls map={mockMap} />);

    fireEvent.click(screen.getByText('Fly to Location'));

    expect(mockFlyTo).toHaveBeenCalledWith({
      center: [0, 0],
      zoom: 10,
    });
  });
});
```

### Memory Impact

- **Without mocking**: ~50-100MB per test file (WebGL, tile caching)
- **With mocking**: ~3-5MB per test file

---

## Turf.js

### When to Mock

⚠️ **Turf.js mocking is NOT recommended for most use cases.**

**Analysis findings:**

- Only 1 source file uses Turf.js (`geometry-validation.ts`)
- Used for critical self-intersection detection (`turf.kinks()`)
- Mocking would compromise test validity
- Memory impact is minimal (~5-10MB vs originally estimated 50-100MB)

**Recommendation:** Keep real Turf.js for spatial calculations. Only mock if you have many tests that don't actually need accurate spatial operations.

### If You Must Mock

Only mock Turf.js when testing business logic that doesn't depend on accurate spatial calculations:

```typescript
vi.mock('@turf/turf', () => ({
  // Only mock functions you don't actually need to test
  kinks: vi.fn(() => ({ type: 'FeatureCollection', features: [] })),
  area: vi.fn(() => 100),
  // Keep real implementations for critical tests
}));
```

### Better Alternative

Instead of mocking Turf.js, use **minimal test geometries** (see [GeoJSON Fixtures](#geojson-fixtures)).

---

## Memory Profiling

### Overview

Use the memory profiler utility to identify memory-heavy tests and track improvements.

**Location:** `src/__tests__/utils/test-memory-profiler.ts`

### Usage

**Standard Pattern:**

```typescript
import { describe, it, afterAll } from 'vitest';
import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';

describe('MyComponent', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  it('should render correctly', () => {
    // Your test
  });
});
```

### Configuration Options

**`enableMemoryProfiling(options)`**

- `warnThresholdMB` (default: 100) - Warn if test exceeds this RSS memory
- Automatically captures memory before/after each test
- Tracks heap, RSS, and external memory

**`printMemorySummary(options)`**

- `sortBy` - Sort by: `'heap'`, `'rss'`, or `'external'`
- `topN` (default: 10) - Show top N memory-consuming tests
- Prints table to console with per-test breakdown

### Example Output

```
┌─────────┬──────────────────────────────────┬────────────┬─────────┬────────────┐
│ (index) │ test                             │ heapUsedMB │ rssMB   │ externalMB │
├─────────┼──────────────────────────────────┼────────────┼─────────┼────────────┤
│ 0       │ 'should render all tabs'         │ '4.72'     │ '12.34' │ '0.01'     │
│ 1       │ 'should handle selection'        │ '3.21'     │ '8.45'  │ '0.01'     │
│ 2       │ 'should validate input'          │ '2.15'     │ '5.67'  │ '0.00'     │
└─────────┴──────────────────────────────────┴────────────┴─────────┴────────────┘
```

### Interpreting Results

- **heapUsedMB**: JavaScript heap memory (V8)
- **rssMB**: Resident Set Size (total process memory, including native)
- **externalMB**: External memory (buffers, WebGL, etc.)

**Warning signs:**

- RSS > 50MB for a single test → Consider mocking heavy dependencies
- Heap > 30MB → Check for memory leaks or large data structures
- External > 10MB → WebGL/Canvas likely not mocked

---

## GeoJSON Fixtures

### Overview

Use minimal valid geometries for most tests. Only use complex geometries when testing actual spatial algorithms.

### Best Practices

**✅ Good: Minimal Geometries**

```typescript
// Minimal polygon (4-5 coordinates)
const minimalPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0], // Close the ring
    ],
  ],
};

// Minimal point
const minimalPoint = {
  type: 'Point',
  coordinates: [0, 0],
};

// Minimal line
const minimalLine = {
  type: 'LineString',
  coordinates: [
    [0, 0],
    [10, 10],
  ],
};
```

**❌ Bad: Overly Complex Geometries**

```typescript
// Don't do this unless testing actual spatial operations
const complexPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      // 100+ coordinate pairs...
      [0, 0],
      [1, 0],
      [2, 0] /* ... */,
      ,
      [100, 100],
    ],
  ],
};
```

### Mock Data Reduction

The `src/__tests__/mocks/data.ts` file has been optimized:

- **Events**: 2 items (was 5+)
- **Encounters**: 2 items (was 5+)
- **Effects**: 2 items (was 5+)
- **All geometries**: 3-5 coordinates max

**Comment added:**

```typescript
// Reduced to 2-3 essential items for memory efficiency
// Phase 1 - test data reduction (mitigation plan)
```

### When to Use Real GeoJSON Data

Only use complex GeoJSON when:

- Testing actual spatial calculations (area, intersection, buffering)
- Testing edge cases (self-intersecting polygons, holes, multi-geometries)
- Integration testing with real map rendering (E2E only)

---

## Apollo Client

### Overview

Use Mock Service Worker (MSW) for GraphQL mocking instead of Apollo's `MockedProvider` when possible. MSW intercepts network requests, providing more realistic testing.

### Standard Pattern (MockedProvider)

```typescript
import { MockedProvider } from '@apollo/client/testing';
import { render } from '@testing-library/react';

const mocks = [
  {
    request: {
      query: GET_CAMPAIGN,
      variables: { id: '1' },
    },
    result: {
      data: {
        campaign: { id: '1', name: 'Test Campaign' },
      },
    },
  },
];

it('should load campaign data', () => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <CampaignView />
    </MockedProvider>
  );

  // Test component with mocked data
});
```

### Alternative: Mock Service Worker (MSW)

For more realistic testing (recommended for integration tests):

```typescript
import { setupServer } from 'msw/node';
import { graphql } from 'msw';

const server = setupServer(
  graphql.query('GetCampaign', (req, res, ctx) => {
    return res(
      ctx.data({
        campaign: { id: '1', name: 'Test Campaign' },
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Best Practices

### 1. Always Add Comments

Mark mocked dependencies with comments explaining WHY:

```typescript
// Phase 1 (Mitigation Plan) Task 1.2: Mock React Flow to reduce memory usage
vi.mock('@xyflow/react', async () => {
  const mocks = await import('@/__tests__/mocks/react-flow');
  return mocks.createReactFlowMock();
});
```

### 2. Use Memory Profiling During Development

Add profiling to new test suites to catch memory issues early:

```typescript
enableMemoryProfiling({ warnThresholdMB: 50 });

afterAll(() => {
  printMemorySummary({ sortBy: 'rss', topN: 10 });
});
```

### 3. Mock at the Right Level

- **Unit tests**: Heavy mocking (React Flow, MapLibre, Apollo)
- **Integration tests**: Moderate mocking (Apollo only, real UI libraries)
- **E2E tests**: No mocking (real everything)

### 4. Test What Matters

Don't test library behavior. Test YOUR code:

```typescript
// ✅ Good: Testing component logic
it('should select node when clicked', () => {
  const onSelect = vi.fn();
  render(<FlowNode id="1" onSelect={onSelect} />);
  fireEvent.click(screen.getByTestId('node-1'));
  expect(onSelect).toHaveBeenCalledWith('1');
});

// ❌ Bad: Testing React Flow behavior
it('should render bezier edge', () => {
  render(<BezierEdge />);
  // Testing React Flow's rendering logic, not yours
});
```

### 5. Keep Mocks Minimal

Only mock the methods you actually use:

```typescript
// ✅ Good: Minimal mock
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    addLayer: vi.fn(),
  })),
}));

// ❌ Bad: Over-mocking
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    /* 50+ methods you don't use */
  })),
}));
```

### 6. Reuse Existing Mocks

Import from centralized mock files instead of duplicating:

```typescript
// ✅ Good: Reuse existing mock
import { createReactFlowMock } from '@/__tests__/mocks/react-flow';
vi.mock('@xyflow/react', createReactFlowMock);

// ❌ Bad: Duplicate mock logic
vi.mock('@xyflow/react', () => ({
  ReactFlow: () => null,
  // ... duplicate all the mock setup
}));
```

### 7. Clean Up After Tests

Ensure mocks don't leak between tests:

```typescript
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks(); // Clear mock call history
  // Cleanup is automatic in Vitest, but explicit is better
});
```

---

## Reference Files

### Mock Utilities

- **React Flow Mock**: `src/__tests__/mocks/react-flow.tsx`
- **Mock Data**: `src/__tests__/mocks/data.ts`
- **Memory Profiler**: `src/__tests__/utils/test-memory-profiler.ts`
- **Memory Profiler Guide**: `src/__tests__/utils/test-memory-profiler-guide.md`

### Documentation

- **Test Memory Mitigation Plan**: `docs/development/test-memory-mitigation-plan.md`
- **Test Memory Benchmarking Plan**: `docs/development/test-memory-benchmarking-plan.md`

### Example Test Files

Examples of properly mocked tests:

- `src/pages/FlowViewPage.test.tsx` (React Flow)
- `src/components/features/flow/SelectionPanel.test.tsx` (React Flow)
- `src/components/features/branches/BranchHierarchyView.test.tsx` (React Flow)
- `src/utils/graph-layout.test.ts` (React Flow utilities)

---

## Getting Help

- Check existing test files for patterns
- Review `src/__tests__/mocks/` for available mocks
- Run memory profiler to identify heavy tests
- Consult [Test Memory Mitigation Plan](../../../../docs/development/test-memory-mitigation-plan.md) for strategy context

---

**Last Updated:** 2025-11-04
**Maintained by:** Development Team
