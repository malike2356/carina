import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'packages/web/src/**/*.test.ts', 'packages/packs/**/*.test.ts', 'packages/transport/src/**/*.test.ts'],
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
