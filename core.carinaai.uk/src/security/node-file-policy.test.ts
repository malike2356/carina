import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

describe('node-file-policy', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.CARINA_HOME = process.env.CARINA_HOME;
    saved.CARINA_NODE_FILE_ROOTS = process.env.CARINA_NODE_FILE_ROOTS;
    saved.CARINA_NODE_FILE_POLICY = process.env.CARINA_NODE_FILE_POLICY;
    process.env.CARINA_HOME = '/tmp/carina-test-home';
    delete process.env.CARINA_NODE_FILE_ROOTS;
    delete process.env.CARINA_NODE_FILE_POLICY;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('allows paths under default node-files root', async () => {
    const { evaluateNodeFilePath } = await import('./node-file-policy.js');
    const target = path.join('/tmp/carina-test-home', 'node-files', 'out.txt');
    const d = evaluateNodeFilePath(target);
    expect(d.allowed).toBe(true);
  });

  it('blocks paths outside allowed roots', async () => {
    const { evaluateNodeFilePath } = await import('./node-file-policy.js');
    const d = evaluateNodeFilePath('/etc/passwd');
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/outside allowed roots/);
  });

  it('honours CARINA_NODE_FILE_ROOTS', async () => {
    const root = path.join(os.tmpdir(), 'carina-custom-root');
    process.env.CARINA_NODE_FILE_ROOTS = root;
    const { evaluateNodeFilePath } = await import('./node-file-policy.js');
    const inside = path.join(root, 'data.bin');
    expect(evaluateNodeFilePath(inside).allowed).toBe(true);
    expect(evaluateNodeFilePath('/tmp/other').allowed).toBe(false);
  });

  it('can be disabled with CARINA_NODE_FILE_POLICY=off', async () => {
    process.env.CARINA_NODE_FILE_POLICY = 'off';
    const { evaluateNodeFilePath } = await import('./node-file-policy.js');
    expect(evaluateNodeFilePath('/etc/passwd').allowed).toBe(true);
  });
});
