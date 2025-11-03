import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/__tests__/setup.ts',
    // Include ONLY performance tests
    include: ['src/__performance__/**/*.performance.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Run tests in fork processes to prevent memory accumulation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        minForks: 1,
        maxForks: 1,
        execArgv: ['--max-old-space-size=6144', '--expose-gc'],
      },
    },
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 30000, // Longer timeout for performance tests
    hookTimeout: 15000,
    isolate: true,
  },
});
