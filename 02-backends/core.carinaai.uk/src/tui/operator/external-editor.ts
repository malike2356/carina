import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';

export async function openExternalEditor(initialContent = ''): Promise<string> {
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-compose-'));
  const filePath = path.join(tmpDir, 'message.md');
  await fs.writeFile(filePath, initialContent, 'utf-8');

  const result = spawnSync(editor, [filePath], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw new Error(`Editor exited with code ${result.status ?? 'unknown'}`);
  }

  const edited = await fs.readFile(filePath, 'utf-8');
  await fs.rm(tmpDir, { recursive: true, force: true });
  return edited.replace(/\n$/, '');
}
