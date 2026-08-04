// FLOSS string deobfuscation
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runFloss(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.floss?.binary || 'floss';
  const available = Boolean(cfg.arsenal.floss?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'floss',
      ok: false,
      available: false,
      summary: 'FLOSS not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const result = await runCommand(binary, [targetPath], { timeoutMs: 120_000 });
  const strings = result.stdout.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 500);
  return {
    tool: 'floss',
    ok: result.code === 0,
    available: true,
    summary: result.code === 0 ? `Extracted ${strings.length} strings` : 'FLOSS failed',
    findings: { strings },
    durationMs: Date.now() - started,
  };
}
