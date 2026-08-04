// Radare2 ELF analysis
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runRadare2(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.radare2?.binary || 'r2';
  const available = Boolean(cfg.arsenal.radare2?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'radare2',
      ok: false,
      available: false,
      summary: 'Radare2 not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const result = await runCommand(binary, ['-q', '-c', 'aaa;iI;iz', targetPath], { timeoutMs: 60_000 });
  return {
    tool: 'radare2',
    ok: result.code === 0,
    available: true,
    summary: result.code === 0 ? 'Radare2 info extracted' : 'Radare2 failed',
    findings: { info: result.stdout.slice(0, 20_000) },
    raw: result.stdout.slice(0, 50_000),
    durationMs: Date.now() - started,
  };
}
