// Volatility 3 memory forensics
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runVolatility(dumpPath: string, plugin = 'windows.pslist.PsList'): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.volatility?.binary || 'vol';
  const available = Boolean(cfg.arsenal.volatility?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'volatility',
      ok: false,
      available: false,
      summary: 'Volatility 3 not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const result = await runCommand(binary, ['-f', dumpPath, plugin], { timeoutMs: 180_000 });
  return {
    tool: 'volatility',
    ok: result.code === 0,
    available: true,
    summary: result.code === 0 ? `Volatility plugin ${plugin} completed` : 'Volatility failed',
    findings: { plugin, lines: result.stdout.split('\n').length },
    raw: result.stdout.slice(0, 50_000),
    durationMs: Date.now() - started,
  };
}
