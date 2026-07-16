import { readFile } from 'fs/promises';
import path from 'path';
import {
  bootstrapSpecsForMode,
  formatBootstrapHeader,
  type BootstrapMode,
} from './bootstrap-files.js';

export type WorkspaceContextOptions = {
  mode?: BootstrapMode;
};

export function workspaceContextHasIdentity(context?: string): boolean {
  if (!context?.trim()) return false;
  return (
    context.includes('(SOUL.md)')
    || context.includes('(IDENTITY.md)')
    || context.includes('AIVA_WORKER_IDENTITY')
  );
}

export async function loadWorkspaceFile(
  homeDir: string,
  fileName: string,
): Promise<string | null> {
  const filePath = path.join(homeDir, fileName);
  try {
    const content = await readFile(filePath, 'utf-8');
    const trimmed = content.trim();
    return trimmed || null;
  } catch (err) {
    if (isMissingFile(err)) return null;
    throw err;
  }
}

export async function loadWorkspaceContext(
  homeDir: string,
  options: WorkspaceContextOptions = {},
): Promise<string[]> {
  const mode = options.mode ?? 'full';
  const parts: string[] = [];

  for (const file of bootstrapSpecsForMode(mode)) {
    const filePath = path.join(homeDir, file.name);
    try {
      const content = await readFile(filePath, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) continue;
      parts.push(`${formatBootstrapHeader(file)}\n\n${trimmed}`);
    } catch (err) {
      if (isMissingFile(err)) continue;
      throw err;
    }
  }

  return parts;
}

function isMissingFile(err: unknown): boolean {
  return typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT';
}
