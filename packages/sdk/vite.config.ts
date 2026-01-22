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
      // React is external - users bring their own
      external: ['react'],
      output: {
        globals: {
          react: 'React',
        },
      },
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
