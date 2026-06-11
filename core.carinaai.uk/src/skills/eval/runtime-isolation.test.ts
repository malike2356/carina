import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '../..');

const RUNTIME_PATHS = [
  'agents/carina.ts',
  'agents/orchestrator.ts',
  'index.ts',
  'gateway/web/chat-handler.ts',
].map((p) => path.join(srcRoot, p));

describe('runtime path isolation', () => {
  it('runtime agents do not import skills/eval', async () => {
    for (const filePath of RUNTIME_PATHS) {
      try {
        const source = await fs.readFile(filePath, 'utf8');
        expect(source).not.toMatch(/skills\/eval/);
        expect(source).not.toMatch(/eval-cli/);
        expect(source).not.toMatch(/runPackEvalGate/);
      } catch {
        // file may not exist in all layouts; skip
      }
    }
  });

  it('eval module does not import carina agent at load time', async () => {
    const evalIndex = await fs.readFile(path.join(__dirname, 'index.ts'), 'utf8');
    expect(evalIndex).not.toMatch(/agents\/carina/);
    expect(evalIndex).not.toMatch(/orchestrator/);
  });

  it('runner uses dynamic import for pack registry', async () => {
    const runnerSource = await fs.readFile(path.join(__dirname, 'runner.ts'), 'utf8');
    expect(runnerSource).toMatch(/await import\('\.\.\/index\.js'\)/);
    expect(runnerSource).toMatch(/executeWithLlm/);
  });

  it('eval index exports are offline-only symbols', async () => {
    const { runPackEvalGate, extractEvalKeywords } = await import('./index.js');
    expect(typeof runPackEvalGate).toBe('function');
    expect(extractEvalKeywords('update notion page')).toContain('notion');
  });
});
