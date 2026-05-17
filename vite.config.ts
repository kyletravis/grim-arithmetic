import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the Web Worker URL resolves alongside dist/grim-arithmetic.js
  // when Foundry serves the module from /modules/grim-arithmetic/ rather than
  // a host-root. Without this Vite emits "/assets/simulation.worker-*.js" which
  // Foundry resolves against the server root and 404s.
  base: './',
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'GrimArithmetic',
      formats: ['es'],
      fileName: () => 'grim-arithmetic.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
        entryFileNames: 'grim-arithmetic.js',
        assetFileNames: 'grim-arithmetic.[ext]'
      }
    }
  },
  worker: {
    format: 'es'
  }
});
