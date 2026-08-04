import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadWorkspaceContext } from './context-files.js';

let tmpDir: string | undefined;

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

async function makeHome(): Promise<string> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'carina-home-'));
  return tmpDir;
}

describe('loadWorkspaceContext', () => {
  it('loads existing workspace files in stable order', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'MEMORY.md'), 'Remember this.', 'utf-8');
    await writeFile(path.join(home, 'AGENTS.md'), 'Follow local rules.', 'utf-8');

    const context = await loadWorkspaceContext(home);

    expect(context).toHaveLength(2);
    expect(context[0]).toContain('AGENTS.md');
    expect(context[0]).toContain('Follow local rules.');
    expect(context[1]).toContain('MEMORY.md');
  });

  it('skips missing and empty files', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'USER.md'), '  ', 'utf-8');

    await expect(loadWorkspaceContext(home)).resolves.toEqual([]);
  });

  it('frames persona files as local notes, not product identity overrides', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'SOUL.md'), 'Be terse.', 'utf-8');

    const context = await loadWorkspaceContext(home);

    expect(context[0]).toContain('do not replace Carina');
  });
});
