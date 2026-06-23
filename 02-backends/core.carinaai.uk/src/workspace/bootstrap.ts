import { readFile, rm } from 'fs/promises';
import path from 'path';

export type BootstrapRunner = (instructions: string) => Promise<void>;

export async function runBootstrapIfPresent(
  homeDir: string,
  runner?: BootstrapRunner,
): Promise<boolean> {
  const bootstrapPath = path.join(homeDir, 'BOOTSTRAP.md');
  let instructions: string;

  try {
    instructions = await readFile(bootstrapPath, 'utf-8');
  } catch (err) {
    if (isMissingFile(err)) return false;
    throw err;
  }

  const trimmed = instructions.trim();
  if (!trimmed) {
    await rm(bootstrapPath);
    return true;
  }

  if (runner) {
    await runner(`Run this one-shot self-hosted CLI bootstrap task, then report completion succinctly.\n\n${trimmed}`);
  }

  await rm(bootstrapPath);
  return true;
}

function isMissingFile(err: unknown): boolean {
  return typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT';
}
