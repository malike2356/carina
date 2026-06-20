import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let cachedVersion: string | null = null;

export function carinaRuntimeVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../package.json',
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    cachedVersion = pkg.version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

export function parseSemver(version: string): [number, number, number] {
  const cleaned = version.replace(/^v/i, '').split('-')[0] ?? '0';
  const parts = cleaned.split('.').map((p) => Number.parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** True when current >= minimum (major.minor.patch). */
export function satisfiesMinVersion(current: string, minimum: string): boolean {
  const [cM, cm, cp] = parseSemver(current);
  const [mM, mm, mp] = parseSemver(minimum);
  if (cM !== mM) return cM > mM;
  if (cm !== mm) return cm > mm;
  return cp >= mp;
}
