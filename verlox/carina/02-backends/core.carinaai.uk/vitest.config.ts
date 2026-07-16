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
    env: {
      CARINA_COVERAGE_RUN: process.argv.includes('--coverage') ? 'true' : 'false',
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'packages/web/src/**/*.test.ts', 'packages/packs/**/*.test.ts', 'packages/transport/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/skills/hub/**', 'src/api/hosted*.ts'],
      thresholds: {
        // Ratchet from the measured 2026-07-16 baseline. Raise these values as
        // new tests land; CI prevents coverage from falling below this floor.
        lines: 39,
        functions: 48,
        branches: 30,
        statements: 38,
      },
    },
  },
});
