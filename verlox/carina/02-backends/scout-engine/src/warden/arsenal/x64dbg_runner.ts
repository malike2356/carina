// x64dbg Windows debugging (sandbox host)
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists } from './run.js';

export async function runX64dbg(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.x64dbg?.binary || 'x64dbg';
  const available = Boolean(cfg.arsenal.x64dbg?.enabled) && commandExists(binary);
  return {
    tool: 'x64dbg',
    ok: false,
    available,
    summary: available
      ? `x64dbg available; schedule interactive debug for ${targetPath} in Windows sandbox`
      : 'x64dbg not available on this host',
    findings: { targetPath, mode: 'manual-sandbox' },
    durationMs: Date.now() - started,
  };
}
