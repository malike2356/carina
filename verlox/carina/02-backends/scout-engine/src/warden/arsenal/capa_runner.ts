// capa capability detection
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runCapa(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.capa?.binary || 'capa';
  const available = Boolean(cfg.arsenal.capa?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'capa',
      ok: false,
      available: false,
      summary: 'capa not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const result = await runCommand(binary, ['-j', targetPath], { timeoutMs: 120_000 });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    parsed = { raw_lines: result.stdout.split('\n').slice(0, 50) };
  }
  return {
    tool: 'capa',
    ok: result.code === 0,
    available: true,
    summary: result.code === 0 ? 'capa capability map ready' : 'capa failed',
    findings: parsed,
    durationMs: Date.now() - started,
  };
}
