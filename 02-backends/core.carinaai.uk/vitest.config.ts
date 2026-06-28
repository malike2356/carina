import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#core': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 15000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'packages/web/src/**/*.test.ts', 'packages/packs/**/*.test.ts', 'packages/transport/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/skills/hub/**', 'src/api/hosted*.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
});
