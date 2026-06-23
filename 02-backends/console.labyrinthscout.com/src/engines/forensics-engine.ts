import fs from 'node:fs/promises';
import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

export async function runLog2timelineScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  const evidencePath = typeof ctx.config?.evidence_path === 'string' ? ctx.config.evidence_path : '';
  if (!evidencePath) return skippedResult('log2timeline');
  if (!(await commandExists('log2timeline.py'))) return skippedResult('log2timeline');

  const { stdout, exitCode } = await runCommand(
    'log2timeline.py',
    [evidencePath, '/tmp/scout-plaso.plaso'],
    600_000,
  );

  if (exitCode !== 0) return skippedResult('log2timeline');

  return {
    findings: [{
      tool: 'log2timeline',
      findingType: 'timeline',
      severity: 'info',
      title: `Super timeline created for ${ctx.domain}`,
      description: stdout.slice(0, 500) || 'Plaso storage file generated.',
      rawData: { evidencePath, domain: ctx.domain },
    }],
    engine: 'log2timeline',
  };
}

export async function runTimesketchScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  const sketchId = typeof ctx.config?.timesketch_id === 'string' ? ctx.config.timesketch_id : '';
  if (!sketchId) return skippedResult('timesketch');

  return {
    findings: [{
      tool: 'timesketch',
      findingType: 'timeline',
      severity: 'info',
      title: `Timesketch sketch ${sketchId} linked`,
      description: `Configure Timesketch API credentials to query sketch ${sketchId} for ${ctx.domain}.`,
      rawData: { sketchId, domain: ctx.domain },
    }],
    engine: 'timesketch',
  };
}

export async function runYaraScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  const rulesPath = typeof ctx.config?.yara_rules === 'string'
    ? ctx.config.yara_rules
    : process.env.SCOUT_YARA_RULES ?? '';
  const scanPath = typeof ctx.config?.yara_target === 'string' ? ctx.config.yara_target : '';

  if (!rulesPath || !scanPath) return skippedResult('yara');
  if (!(await commandExists('yara'))) return skippedResult('yara');

  try {
    await fs.access(rulesPath);
    await fs.access(scanPath);
  } catch {
    return skippedResult('yara');
  }

  const { stdout, exitCode } = await runCommand(
    'yara',
    ['-s', rulesPath, scanPath],
    120_000,
  );

  if (exitCode !== 0 && !stdout.trim()) return { findings: [], engine: 'yara' };

  const findings: EngineFinding[] = [];
  for (const line of stdout.split('\n')) {
    const match = line.match(/^(\S+)\s+(\S+)/);
    if (!match) continue;
    findings.push({
      tool: 'yara',
      findingType: 'malware',
      severity: 'high',
      title: `YARA match: ${match[1]}`,
      description: `Rule ${match[1]} matched ${match[2]}.`,
      rawData: { rule: match[1], target: match[2] },
    });
  }

  return { findings: findings.slice(0, 30), engine: 'yara' };
}
