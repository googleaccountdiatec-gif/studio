import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // server-only throws by design when imported from a client bundle.
      // In tests we don't have a server/client distinction; stub it to a no-op.
      'server-only': path.resolve(__dirname, './vitest-shims/server-only.ts'),
    },
  },
});
