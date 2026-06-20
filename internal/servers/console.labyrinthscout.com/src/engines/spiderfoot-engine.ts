import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

export async function runSpiderfootScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (ctx.targetType !== 'domain') return skippedResult('spiderfoot');
  if (!(await commandExists('spiderfoot'))) return skippedResult('spiderfoot');

  const { stdout, exitCode } = await runCommand(
    'spiderfoot',
    ['-s', ctx.domain, '-q', '-max', '25'],
    300_000,
  );

  if (exitCode !== 0 && !stdout.trim()) return skippedResult('spiderfoot');

  const findings: EngineFinding[] = [];
  for (const line of stdout.split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 4) continue;
    const [, eventType, , data] = parts;
    if (!data?.trim()) continue;
    findings.push({
      tool: 'spiderfoot',
      findingType: 'osint',
      severity: 'info',
      title: `SpiderFoot: ${eventType ?? 'finding'}`,
      description: data.trim().slice(0, 500),
      rawData: { eventType, data: data.trim(), domain: ctx.domain },
    });
  }

  return { findings: findings.slice(0, 50), engine: 'spiderfoot' };
}
