import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve config/aiva/*.json whether running from:
 * - src/workers/product-tools (dev)
 * - dist/src/workers/product-tools (Docker / tsc with rootDir .)
 * - cwd override / env absolute path
 */
export function resolveAivaConfigFile(
  envValue: string | undefined,
  filename: string,
  importMetaUrl: string,
): string {
  const trimmed = envValue?.trim();
  if (trimmed) return path.resolve(trimmed);

  const candidates: string[] = [];
  const cwd = process.cwd();
  candidates.push(path.resolve(cwd, 'config', 'aiva', filename));
  candidates.push(path.resolve(cwd, '..', 'config', 'aiva', filename));

  let dir = path.dirname(fileURLToPath(importMetaUrl));
  for (let i = 0; i < 8; i += 1) {
    candidates.push(path.resolve(dir, 'config', 'aiva', filename));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Explicit Docker layout fallback
  candidates.push(path.resolve('/app/config/aiva', filename));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Prefer package-root relative to this module (dist/src/workers/product-tools -> ../../../../config)
  const here = path.dirname(fileURLToPath(importMetaUrl));
  return path.resolve(here, '../../../../config/aiva', filename);
}
