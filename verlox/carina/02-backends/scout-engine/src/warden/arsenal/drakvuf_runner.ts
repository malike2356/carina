// DRAKVUF agentless sandbox
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runDrakvuf(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.drakvuf?.binary || 'drakvuf';
  const available = Boolean(cfg.arsenal.drakvuf?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'drakvuf',
      ok: false,
      available: false,
      summary: 'DRAKVUF not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const result = await runCommand(binary, ['-i', targetPath], { timeoutMs: 300_000 });
  return {
    tool: 'drakvuf',
    ok: result.code === 0,
    available: true,
    summary: result.code === 0 ? 'DRAKVUF monitoring completed' : 'DRAKVUF failed',
    findings: { code: result.code },
    raw: result.stdout.slice(0, 50_000),
    durationMs: Date.now() - started,
  };
}
