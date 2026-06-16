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
  it('loads existing workspace files in stable bootstrap order', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'MEMORY.md'), 'Remember this.', 'utf-8');
    await writeFile(path.join(home, 'AGENTS.md'), 'Follow local rules.', 'utf-8');
    await writeFile(path.join(home, 'SOUL.md'), 'Be terse.', 'utf-8');

    const context = await loadWorkspaceContext(home);

    expect(context).toHaveLength(3);
    expect(context[0]).toContain('SOUL.md');
    expect(context[0]).toContain('Tier: identity');
    expect(context[1]).toContain('AGENTS.md');
    expect(context[2]).toContain('MEMORY.md');
  });

  it('loads minimal bootstrap files for subagents', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'SOUL.md'), 'Voice', 'utf-8');
    await writeFile(path.join(home, 'AGENTS.md'), 'Rules', 'utf-8');
    await writeFile(path.join(home, 'TOOLS.md'), 'Tool notes', 'utf-8');

    const context = await loadWorkspaceContext(home, { mode: 'minimal' });

    expect(context).toHaveLength(2);
    expect(context[0]).toContain('AGENTS.md');
    expect(context[1]).toContain('TOOLS.md');
  });

  it('skips missing and empty files', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'USER.md'), '  ', 'utf-8');

    await expect(loadWorkspaceContext(home)).resolves.toEqual([]);
  });

  it('frames SOUL as voice and tone tier', async () => {
    const home = await makeHome();
    await writeFile(path.join(home, 'SOUL.md'), 'Be terse.', 'utf-8');

    const context = await loadWorkspaceContext(home);

    expect(context[0]).toContain('Voice and tone');
    expect(context[0]).toContain('Tier: identity');
  });
});
