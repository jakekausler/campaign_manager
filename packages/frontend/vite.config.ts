import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Read port configuration from environment variables
const FRONTEND_PORT = parseInt(process.env.VITE_PORT || process.env.PORT || '9263', 10);
const BACKEND_PORT = parseInt(process.env.VITE_BACKEND_PORT || '9264', 10);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: FRONTEND_PORT,
    host: true,
    strictPort: false,
    proxy: {
      // Proxy GraphQL requests to backend API
      '/graphql': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying for GraphQL subscriptions
      },
      // Proxy API requests (if any REST endpoints exist)
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },

  preview: {
    port: FRONTEND_PORT,
    host: true,
  },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/__tests__/setup.ts',
    // Exclude performance tests from default test runs
    // Performance tests are run separately via `pnpm test:performance`
    // This prevents memory spikes from large dataset generation during regular testing
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__performance__/**',
      '**/*.performance.test.{ts,tsx}',
    ],
    // Memory-conscious test sequencing
    // Keep tests deterministic and run hooks in stack order for better memory management
    sequence: {
      shuffle: false, // Keep deterministic order
      hooks: 'stack', // Run hooks in stack order
    },
    // Run tests in fork processes to prevent memory accumulation
    pool: 'forks',
    poolOptions: {
      forks: {
        // Phase 4 optimization: Enable singleFork for better memory recovery
        // Single fork allows garbage collection between test files
        singleFork: true,
        minForks: 1,
        maxForks: 1, // Only 1 fork active at a time (sequential execution)
        // Phase 4+7 final: Set to 6144MB (6GB) - matches original working allocation
        // Phase 7 removed error-masking wrapper script, exposing real memory requirements
        // Phases 1-6 cleanup improved test stability but didn't reduce memory as projected
        // Reality: Tests require ~6GB for reliable execution without crashes
        // Removed --expose-gc: V8's automatic GC is more efficient than manual GC
        execArgv: ['--max-old-space-size=6144'],
        // Enable proper test isolation
        isolate: true,
      },
    },
    // Ensure proper cleanup between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Disable file parallelism to prevent memory spikes
    // Tests run sequentially (1 file at a time) to reduce memory pressure
    // Performance impact: ~15-20% slower, but prevents worker crashes
    fileParallelism: false,
    // Increase timeout for slow tests
    testTimeout: 15000,
    hookTimeout: 15000,
    // Enable isolation to ensure clean environment per test file
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'dist/',
        // Exclude performance tests from coverage
        '**/__performance__/**',
      ],
    },
  },
});
