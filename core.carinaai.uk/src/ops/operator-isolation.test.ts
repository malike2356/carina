import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const srcRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('operator management isolation', () => {
  it('agent loop does not import operator CLI modules', () => {
    const files = [
      path.join(srcRoot, 'agents', 'carina.ts'),
      path.join(srcRoot, 'agents', 'tool-runner.ts'),
      path.join(srcRoot, 'gateway', 'router.ts'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes('curator-cli')).toBe(false);
      expect(source.includes('kanban-cli')).toBe(false);
      expect(source.includes('ops/operator-profile')).toBe(false);
    }
  });

  it('curator scheduler stays opt-in via env flag', () => {
    const source = readFileSync(path.join(srcRoot, 'skills', 'curator-scheduler.ts'), 'utf8');
    expect(source.includes("CARINA_SKILL_CURATOR_ENABLED !== 'true'")).toBe(true);
  });

  it('agent loop does not import ops health or migration modules', () => {
    const files = [
      path.join(srcRoot, 'agents', 'orchestrator.ts'),
      path.join(srcRoot, 'agents', 'tool-runner.ts'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes('health-check')).toBe(false);
      expect(source.includes('migration/')).toBe(false);
      expect(source.includes('backup-restore')).toBe(false);
      expect(source.includes('taskflows/')).toBe(false);
      expect(source.includes('acp-bridge')).toBe(false);
      expect(source.includes('debug-proxy-capture')).toBe(false);
      expect(source.includes('extensibility-status')).toBe(false);
      expect(source.includes('operator-status')).toBe(false);
      expect(source.includes('reset-state')).toBe(false);
    }
  });
});
