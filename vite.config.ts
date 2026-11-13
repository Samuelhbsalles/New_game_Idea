import { colyseus } from 'colyseus/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // The game server runs inside Vite's dev server (same port, no proxy):
  // docs/architecture/adr-0001-online-architecture.md.
  // Not under Vitest: tests boot their own server (@colyseus/testing).
  plugins: process.env.VITEST ? [] : [colyseus({ serverEntry: '/server/src/app.ts' })],
  build: {
    outDir: 'dist',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
