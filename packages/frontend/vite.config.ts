import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 3000,
    host: true,
    strictPort: false,
    proxy: {
      // Proxy GraphQL requests to backend API
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying for GraphQL subscriptions
      },
      // Proxy API requests (if any REST endpoints exist)
      '/api': {
        target: 'http://localhost:4000',
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
    port: 3000,
    host: true,
  },
});
