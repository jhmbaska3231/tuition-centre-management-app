// frontend/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // import.meta.dirname is the esm equivalent of __dirname, available from node 20.11
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // consume shared as typescript source rather than its commonjs build. vite compiles
      // it as esm alongside the app, and an edited schema hot reloads without rebuilding
      '@tuition/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // same origin in dev so the refresh cookie behaves exactly like in production
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});