import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve a research tool asset (.py, .R) from src or dist at runtime.
 * Compiled JS lives under dist/src/tools/research; scripts stay in src/tools/research.
 */
export function resolveResearchAsset(filename: string): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const local = resolve(moduleDir, filename);
  if (existsSync(local)) {
    return local;
  }

  const fromProjectSrc = resolve(moduleDir, '../../../../src/tools/research', filename);
  if (existsSync(fromProjectSrc)) {
    return fromProjectSrc;
  }

  const fromCwd = resolve(process.cwd(), 'src/tools/research', filename);
  if (existsSync(fromCwd)) {
    return fromCwd;
  }

  return local;
}
