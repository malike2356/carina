// YARA CLI; files, memory, processes
import fs from 'node:fs';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runYara(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.yara?.binary || 'yara';
  const available = Boolean(cfg.arsenal.yara?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'yara',
      ok: false,
      available: false,
      summary: 'YARA not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const rulesDir = path.join(cfg.rules_dir, 'custom');
  const ruleFiles = fs.existsSync(rulesDir)
    ? fs.readdirSync(rulesDir).filter((f) => f.endsWith('.yar')).map((f) => path.join(rulesDir, f))
    : [];
  if (ruleFiles.length === 0) {
    return {
      tool: 'yara',
      ok: false,
      available: true,
      summary: 'No YARA rules found',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const matches: string[] = [];
  for (const rule of ruleFiles) {
    const result = await runCommand(binary, ['-w', rule, targetPath], { timeoutMs: 30_000 });
    if (result.stdout.trim()) matches.push(...result.stdout.trim().split('\n'));
  }
  return {
    tool: 'yara',
    ok: true,
    available: true,
    summary: matches.length ? `${matches.length} YARA match(es)` : 'No YARA matches',
    findings: { matches },
    raw: matches.join('\n'),
    durationMs: Date.now() - started,
  };
}
