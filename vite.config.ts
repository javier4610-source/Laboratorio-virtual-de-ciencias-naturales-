/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// `--mode single` genera un único bundle (sin división de código) para
// poder incrustarlo en un solo archivo HTML (ver scripts/inline-single.mjs).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    rollupOptions: mode === 'single' ? { output: { inlineDynamicImports: true } } : undefined,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/golden/**/*.test.ts', 'tests/server/**/*.test.ts'],
    environment: 'node',
  },
}));
