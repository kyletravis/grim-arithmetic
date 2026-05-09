import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'GrimArithmetic',
      formats: ['es'],
      fileName: () => 'grim-arithmetic.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'grim-arithmetic.js',
        assetFileNames: 'grim-arithmetic.[ext]'
      }
    }
  }
});
