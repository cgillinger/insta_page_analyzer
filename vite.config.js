import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/insta-page-analyzer/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react', '@radix-ui/react-tabs', '@radix-ui/react-select'],
          utils: ['papaparse', 'xlsx', 'clsx', 'tailwind-merge']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    host: true
  },
  preview: {
    port: 4173,
    strictPort: true,
    open: true
  }
});
