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
    // Run tests in fork processes with memory limits
    // Using multiple forks to distribute memory load
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false, // Use multiple forks to avoid accumulating memory
        minForks: 1,
        maxForks: 2, // Limit concurrent forks to 2
        // Pass memory limit to each fork process
        execArgv: ['--max-old-space-size=4096'],
      },
    },
    // Ensure proper cleanup between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Increase timeout for slow tests
    testTimeout: 15000,
    hookTimeout: 15000,
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
      ],
    },
  },
});
