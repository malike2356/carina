// Scout self-protection
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getEngineRoot, loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';

const baseline = new Map<string, string>();

function hashFile(p: string): string {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

export async function runScoutSensor(): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.scout) return [];
  const out: SensorSignal[] = [];
  const root = getEngineRoot();

  for (const rel of cfg.scout.integrity_paths) {
    const full = path.isAbsolute(rel) ? rel : path.join(root, rel);
    if (!fs.existsSync(full)) {
      out.push(signal('scout', 'Scout integrity path missing', `Missing ${rel}`, 7, 0.8, { artifactPath: full }));
      continue;
    }
    const digest = hashFile(full);
    const prev = baseline.get(full);
    if (!prev) {
      baseline.set(full, digest);
      continue;
    }
    if (prev !== digest) {
      out.push(signal(
        'scout',
        'Scout integrity violation',
        `Hash changed for ${rel}`,
        9,
        0.95,
        { artifactPath: full, evidence: { previous: prev, current: digest } },
      ));
      baseline.set(full, digest);
    }
  }

  if (process.env.LD_PRELOAD) {
    out.push(signal('scout', 'LD_PRELOAD set on Scout process', `LD_PRELOAD=${process.env.LD_PRELOAD}`, 8, 0.85));
  }

  return out;
}
