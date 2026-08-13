import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    target: 'esnext'
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers']
  }
});
