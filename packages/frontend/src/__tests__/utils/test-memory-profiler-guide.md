# Test Memory Profiler - Usage Guide

## Overview

The test memory profiler is a Vitest utility that tracks memory usage for individual test cases. It was created for **Phase 3** of the test memory benchmarking plan to identify specific tests that consume excessive memory or have poor cleanup patterns.

## Important Context from Phase 2

**Critical Finding:** The 6GB crash is caused by **native memory** accumulation from:

- React Flow (Canvas/WebGL rendering)
- MapLibre GL JS (WebGL contexts and tile caching)
- Turf.js/GeoJSON (spatial data processing)
- Happy-DOM (native DOM emulation)

These libraries accumulate ~57 MB/second of native memory (not tracked by Node.js `process.memoryUsage()`). The JavaScript heap remains stable (~56MB) while native memory grows until hitting the 6GB limit.

**What this profiler measures:**

- ✅ JavaScript heap usage (`heapUsed`, `heapTotal`)
- ✅ External memory (ArrayBuffers, etc.)
- ✅ RSS (Resident Set Size) - includes some native memory
- ❌ NOT React Flow's Canvas memory
- ❌ NOT MapLibre GL's WebGL memory
- ❌ NOT GeoJSON spatial data structures

**Use this profiler to:**

- Identify which tests trigger React Flow, MapLibre, or GeoJSON usage
- Find opportunities to mock/stub heavy native dependencies
- Understand which test files contribute most to the accumulation
- Track cleanup patterns and ensure tests properly unmount components

## Quick Start

### Basic Usage

Add to any test file:

```typescript
import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';

describe('MyComponent', () => {
  // Enable profiling for this suite
  enableMemoryProfiling({ warnThresholdMB: 50 });

  it('renders correctly', () => {
    // Your test code...
  });

  it('handles user interaction', () => {
    // Your test code...
  });

  // Print summary after all tests
  afterAll(() => {
    printMemorySummary({ topN: 10 });
  });
});
```

### Configuration Options

```typescript
enableMemoryProfiling({
  warnThresholdMB: 50, // Warn if heap delta > 50MB (default: 50)
  enableGC: false, // Try to run GC before each test (default: false, requires --expose-gc)
});
```

## Usage Patterns

### Pattern 1: Identify High-Memory Tests

```typescript
import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';

describe('EntityInspector', () => {
  enableMemoryProfiling({ warnThresholdMB: 50 });

  it('renders with large dataset', () => {
    render(<EntityInspector entities={largeDataset} />);
    // If this test allocates >50MB heap, you'll see a warning
  });

  afterAll(() => {
    printMemorySummary({ sortBy: 'heapUsed', topN: 5 });
  });
});
```

**Output:**

```
⚠️  High memory usage in test "renders with large dataset": 75.24MB heap delta
   Baseline: 42.10MB
   Final: 117.34MB
   RSS delta: 152.80MB

📊 MEMORY USAGE SUMMARY
Total tests: 8
Avg heap delta: 12.45MB
Avg RSS delta: 34.20MB
Max heap delta: 75.24MB
Max RSS delta: 152.80MB

Top memory-consuming tests:
┌─────┬────────────────────────────────────┬──────────────┬────────────┐
│ idx │ test                               │ heapUsedMB   │ rssMB      │
├─────┼────────────────────────────────────┼──────────────┼────────────┤
│  0  │ renders with large dataset         │ 75.24        │ 152.80     │
│  1  │ handles complex map interactions   │ 45.12        │ 98.45      │
└─────┴────────────────────────────────────┴──────────────┴────────────┘
```

### Pattern 2: Detect Native Memory Leaks

Look for tests where RSS increases significantly more than heap:

```typescript
enableMemoryProfiling({ warnThresholdMB: 50 });

it('renders map with many geometries', () => {
  render(<MapView geometries={manyPolygons} />);
});

// If you see:
// 🔴 POTENTIAL NATIVE MEMORY LEAK: RSS increased by 180.45MB
//    This may indicate React Flow, MapLibre GL, or GeoJSON memory accumulation
```

**What this means:** The test triggered heavy native library usage. Consider:

- Mocking MapLibre GL or React Flow for unit tests
- Reducing test data size (fewer geometries, simpler polygons)
- Ensuring proper cleanup (unmounting components, clearing refs)

### Pattern 3: Verify Cleanup Patterns

```typescript
describe('FlowView cleanup', () => {
  enableMemoryProfiling({ warnThresholdMB: 20 });

  let cleanup: () => void;

  it('mounts FlowView', () => {
    const result = render(<FlowView />);
    cleanup = result.unmount;
    // Memory should increase
  });

  it('after cleanup, memory should be released', () => {
    cleanup();
    // If memory is still high, cleanup may be incomplete
  });

  afterAll(() => {
    const reports = getMemoryReports();
    const mountTest = reports.find(r => r.testName.includes('mounts'));
    const cleanupTest = reports.find(r => r.testName.includes('after cleanup'));

    console.log('Mount memory delta:', mountTest?.delta.rss, 'MB');
    console.log('Cleanup memory delta:', cleanupTest?.delta.rss, 'MB');

    if (cleanupTest && cleanupTest.delta.rss > 0) {
      console.warn('⚠️ Memory not fully released after cleanup');
    }
  });
});
```

### Pattern 4: Category Analysis

Profile different types of tests:

```typescript
// tests/map-components.test.tsx
describe('Map Components', () => {
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    console.log('\n📍 MAP COMPONENTS:');
    printMemorySummary({ topN: 10 });
  });
});

// tests/flow-components.test.tsx
describe('Flow Components', () => {
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    console.log('\n🔄 FLOW COMPONENTS:');
    printMemorySummary({ topN: 10 });
  });
});
```

Compare results to understand which component types use most memory.

## API Reference

### `enableMemoryProfiling(options?)`

Enables memory profiling for all tests in the current `describe` block.

**Options:**

- `warnThresholdMB?: number` - Warn if heap delta exceeds this (default: 50)
- `enableGC?: boolean` - Attempt to run GC before each test (default: false)

**Note:** Must be called at the top level of a `describe` block (not inside a test).

### `getMemoryReports(): TestMemoryReport[]`

Returns all collected memory reports.

**Returns:**

```typescript
interface TestMemoryReport {
  testName: string;
  baseline: NodeJS.MemoryUsage;
  final: NodeJS.MemoryUsage;
  delta: {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    rss: number; // MB
  };
  timestamp: number;
}
```

### `generateMemorySummary(options?)`

Generates a summary object of all memory usage.

**Options:**

- `sortBy?: 'heapUsed' | 'rss'` - Sort metric (default: 'heapUsed')
- `topN?: number` - Only include top N tests (default: all)

**Returns:**

```typescript
{
  totalTests: number;
  avgHeapDelta: number;
  avgRssDelta: number;
  maxHeapDelta: number;
  maxRssDelta: number;
  topTests: Array<{
    test: string;
    heapUsedMB: string;
    rssMB: string;
    externalMB: string;
  }>;
}
```

### `printMemorySummary(options?)`

Prints a formatted summary to console. Same options as `generateMemorySummary`.

### `clearMemoryReports()`

Clears all collected reports. Useful in `beforeAll` to reset state.

### `getMemorySnapshot()`

Gets current memory usage snapshot.

**Returns:**

```typescript
{
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
}
```

### `forceGC(): boolean`

Forces garbage collection if available (requires `--expose-gc` flag).

**Returns:** `true` if GC ran, `false` if not available.

## Interpreting Results

### Understanding Memory Metrics

- **`heapUsed`**: JavaScript objects and primitives allocated
- **`heapTotal`**: Total heap capacity allocated by V8
- **`external`**: Memory used by C++ objects bound to JavaScript (e.g., Buffers)
- **`rss`**: Resident Set Size - total memory occupied by the process (includes native memory)

### Key Indicators

| Indicator             | Meaning                    | Action                                      |
| --------------------- | -------------------------- | ------------------------------------------- |
| High `heapUsed` delta | Large JS object allocation | Reduce test data size, check for leaks      |
| High `rss` delta      | Native memory usage        | Mock React Flow/MapLibre, reduce geometries |
| `rss` >> `heap`       | Native library heavy usage | Primary concern for Phase 3                 |
| Negative delta        | Memory released (GC)       | Good - cleanup working                      |
| Large `external`      | Many Buffers/ArrayBuffers  | Check for Buffer leaks                      |

### Phase 2 Context: Why RSSlta Matters Most

Phase 2 found that heap usage (~56MB) stays stable while native memory grows to 6GB. Therefore:

**High `rss` delta** = Test uses React Flow, MapLibre, or GeoJSON heavily

**Priority for optimization:**

1. Tests with highest `rss` delta (native memory users)
2. Tests with many instances (accumulation over time)
3. Tests that can be mocked/stubbed instead of using real libraries

## Best Practices

### DO:

- ✅ Profile test files that use React Flow, MapLibre, or GeoJSON
- ✅ Compare `rss` deltas to identify native memory users
- ✅ Look for patterns across test suites
- ✅ Use `printMemorySummary` in `afterAll` to see results
- ✅ Mock heavy dependencies for unit tests when possible

### DON'T:

- ❌ Expect heap measurements to explain the 6GB crash (it's native memory)
- ❌ Use `enableGC: true` without `--expose-gc` flag
- ❌ Profile every test file (focus on suspected high-memory ones)
- ❌ Assume negative deltas are bugs (GC is working as intended)

## Examples for Different Test Types

### Component Test (React Flow)

```typescript
import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';

describe('FlowView Component', () => {
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterEach(() => {
    cleanup(); // Important for React Flow!
  });

  it('renders dependency graph', () => {
    render(<FlowView nodes={nodes} edges={edges} />);
    // Expect high RSS delta due to React Flow Canvas
  });

  afterAll(() => {
    console.log('\n🔄 Flow View Memory:');
    printMemorySummary({ sortBy: 'rss', topN: 5 });
  });
});
```

### Component Test (MapLibre)

```typescript
describe('MapView Component', () => {
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterEach(() => {
    cleanup();
  });

  it('renders map with geometries', () => {
    render(<MapView geometries={testGeometries} />);
    // Expect high RSS delta due to MapLibre GL
  });

  afterAll(() => {
    console.log('\n🗺️ Map View Memory:');
    printMemorySummary({ sortBy: 'rss', topN: 5 });
  });
});
```

### Utility Test (GeoJSON)

```typescript
describe('GeoJSON utilities', () => {
  enableMemoryProfiling({ warnThresholdMB: 30 });

  it('processes large polygon', () => {
    const result = processGeometry(largePolygon);
    // GeoJSON processing may use significant native memory
  });

  afterAll(() => {
    console.log('\n📐 GeoJSON Utilities Memory:');
    printMemorySummary({ sortBy: 'rss', topN: 5 });
  });
});
```

## Troubleshooting

### No warnings appear

- Check if `warnThresholdMB` is set too high
- Verify tests are actually allocating memory
- Check that `enableMemoryProfiling()` is called at describe block level

### All deltas are negative

- GC is running aggressively (normal in some cases)
- Try `enableGC: false` option
- This might be expected if previous tests allocated memory

### RSS increases but heap doesn't

- ✅ **This is expected!** Native libraries (React Flow, MapLibre, GeoJSON)
- This is exactly what we're looking for in Phase 3

### "global.gc is not a function" error

- Only occurs if you set `enableGC: true`
- Either remove that option or run tests with `--expose-gc`
- Not critical - profiling works fine without GC

## Next Steps After Profiling

Once you've identified high-memory tests:

1. **Mock heavy dependencies** - Use lightweight mocks for React Flow, MapLibre in unit tests
2. **Reduce test data** - Use smaller datasets, simpler geometries
3. **Improve cleanup** - Ensure components unmount properly, refs are cleared
4. **Split tests** - Run heavy tests in separate processes/files
5. **Consider integration vs unit** - Reserve full library usage for integration tests

## Related Documentation

- [Test Memory Benchmarking Plan](../../../../docs/development/test-memory-benchmarking-plan.md)
- [Phase 1 Results](../../../../docs/development/phase1-memory-benchmark-results.md)
- [Phase 2 Results](../../../../docs/development/phase2-accumulation-analysis-results.md)
