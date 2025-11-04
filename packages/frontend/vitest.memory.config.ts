import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src/**/*.performance.test.{ts,tsx}'],

    // Memory benchmarking configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single worker (sequential)
      },
    },

    // Use custom memory reporter
    reporters: ['default', ['./src/__tests__/utils/memory-reporter.ts', {}]] as any,

    // Slower timeout for memory-intensive tests
    testTimeout: 30000,

    // No parallelization for accurate memory tracking
    maxConcurrency: 1,
    minWorkers: 1,
    maxWorkers: 1,

    // Disable coverage for benchmarking
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
