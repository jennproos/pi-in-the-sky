import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Client date tests assert local times; pin the zone so they pass anywhere.
    env: { TZ: 'America/Chicago' },
  },
});
