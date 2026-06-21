import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  checkpointRoot,
  createCheckpoint,
  latestCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
} from './checkpoint-store.js';

let tmpHome: string;

async function setup(): Promise<void> {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-checkpoint-home-'));
  process.env.CARINA_HOME = tmpHome;
}

afterEach(async () => {
  delete process.env.CARINA_HOME;
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

describe('checkpoint-store', () => {
  it('stores checkpoints under profile CARINA_HOME', async () => {
    await setup();
    expect(checkpointRoot()).toBe(path.join(tmpHome, 'data', 'checkpoints'));
  });

  it('creates, lists, and restores checkpoints', async () => {
    await setup();
    const file = path.join(tmpHome, 'sample.txt');
    await fs.writeFile(file, 'checkpoint me');

    const created = await createCheckpoint({ paths: [file], label: 'test snapshot' });
    expect(created.checkpoint_id).toBeTruthy();

    const listed = await listCheckpoints();
    expect(listed.some((c) => c.checkpoint_id === created.checkpoint_id)).toBe(true);

    const latest = await latestCheckpoint();
    expect(latest?.checkpoint_id).toBe(created.checkpoint_id);

    await fs.writeFile(file, 'modified');
    const restored = await restoreCheckpoint(created.checkpoint_id);
    expect(restored.restored.length).toBeGreaterThan(0);

    const content = await fs.readFile(file, 'utf8');
    expect(content).toBe('checkpoint me');
  });
});
