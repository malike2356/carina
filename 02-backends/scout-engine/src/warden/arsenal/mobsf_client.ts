// MobSF mobile malware scan
import fs from 'node:fs';
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';

export async function runMobsf(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const available = Boolean(cfg.arsenal.mobsf?.enabled && cfg.arsenal.mobsf.base_url);
  if (!available) {
    return {
      tool: 'mobsf',
      ok: false,
      available: false,
      summary: 'MobSF disabled',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  if (!fs.existsSync(targetPath)) {
    return {
      tool: 'mobsf',
      ok: false,
      available: true,
      summary: 'Mobile package not found',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  try {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(targetPath)]), targetPath.split('/').pop() || 'app');
    const res = await fetch(`${cfg.arsenal.mobsf!.base_url}/api/v1/upload`, { method: 'POST', body: form });
    const json = (await res.json()) as Record<string, unknown>;
    return {
      tool: 'mobsf',
      ok: res.ok,
      available: true,
      summary: res.ok ? 'Uploaded to MobSF' : 'MobSF upload failed',
      findings: json,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      tool: 'mobsf',
      ok: false,
      available: true,
      summary: `MobSF error: ${msg}`,
      findings: {},
      durationMs: Date.now() - started,
    };
  }
}
