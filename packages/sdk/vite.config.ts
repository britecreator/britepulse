import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BritePulse',
      fileName: (format) => `britepulse.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // No external dependencies - bundle everything
      external: [],
    },
    minify: 'esbuild',
    sourcemap: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
});
