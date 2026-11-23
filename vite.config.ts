import { defineConfig } from 'vite';

// Relative base: Pages serves the app at /rstr/, the APK from a file root.
export default defineConfig({
  base: './',
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
