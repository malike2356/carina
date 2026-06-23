import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

export async function runSherlockScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (ctx.targetType !== 'domain') return skippedResult('sherlock');
  if (!(await commandExists('sherlock'))) return skippedResult('sherlock');

  const label = ctx.domain.split('.')[0] ?? ctx.domain;
  const { stdout } = await runCommand(
    'sherlock',
    [label, '--print-found', '--timeout', '10'],
    180_000,
  );

  const findings: EngineFinding[] = [];
  for (const line of stdout.split('\n')) {
    const match = line.match(/\[+\]\s+(\S+):\s+(https?:\/\/\S+)/);
    if (!match) continue;
    findings.push({
      tool: 'sherlock',
      findingType: 'osint',
      severity: 'info',
      title: `Username match on ${match[1]}`,
      description: `Sherlock found a profile for ${label} at ${match[2]}.`,
      rawData: { username: label, site: match[1], url: match[2] },
    });
  }

  return { findings: findings.slice(0, 20), engine: 'sherlock' };
}
