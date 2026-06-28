import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CarinaWidget',
      fileName: () => 'widget',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'widget.js',
      },
    },
    minify: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
