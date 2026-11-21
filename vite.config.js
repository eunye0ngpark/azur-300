import { defineConfig } from 'vite';

// base './' keeps dist/ portable (sub-path hosting and file:// inspection)
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.hdr'],
  build: { target: 'es2022', outDir: 'dist' },
});
