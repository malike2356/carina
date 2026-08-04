import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { checkpointManagerTool } from './checkpoint-manager.js';

let tmpDir: string;

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-checkpoint-test-'));
  return tmpDir;
}

afterEach(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('checkpoint-manager', () => {
  it('creates and lists a checkpoint', async () => {
    await setup();
    const file = path.join(tmpDir, 'sample.txt');
    await fs.writeFile(file, 'checkpoint me');

    const created = await checkpointManagerTool.execute({
      action: 'create',
      paths: [file],
      label: 'test snapshot',
    }) as Record<string, unknown>;

    expect(created.checkpoint_id).toBeTruthy();

    const listed = await checkpointManagerTool.execute({ action: 'list' }) as Record<string, unknown>;
    const checkpoints = listed.checkpoints as Array<Record<string, unknown>>;
    expect(checkpoints.some((c) => c.checkpoint_id === created.checkpoint_id)).toBe(true);
  });

  it('restores a checkpoint', async () => {
    await setup();
    const file = path.join(tmpDir, 'restore.txt');
    await fs.writeFile(file, 'original');

    const created = await checkpointManagerTool.execute({
      action: 'create',
      paths: [file],
    }) as Record<string, unknown>;

    await fs.writeFile(file, 'modified');

    const restored = await checkpointManagerTool.execute({
      action: 'restore',
      checkpoint_id: String(created.checkpoint_id),
    }) as Record<string, unknown>;

    expect((restored.restored as string[]).length).toBeGreaterThan(0);
    const content = await fs.readFile(file, 'utf8');
    expect(content).toBe('original');
  });
});
