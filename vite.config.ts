/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode single` genera un único bundle (sin división de código) para
// poder incrustarlo en un solo archivo HTML (ver scripts/inline-single.mjs).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    rollupOptions: mode === 'single' ? { output: { inlineDynamicImports: true } } : undefined,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
    environment: 'node',
  },
}));
