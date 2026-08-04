import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

export async function runHarvesterScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (ctx.targetType !== 'domain') return skippedResult('theHarvester');
  if (!(await commandExists('theHarvester'))) return skippedResult('theHarvester');

  const { stdout } = await runCommand(
    'theHarvester',
    ['-d', ctx.domain, '-b', 'crtsh', '-l', '50'],
    120_000,
  );

  const emails = new Set<string>();
  for (const line of stdout.split('\n')) {
    const match = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (match) emails.add(match[0].toLowerCase());
  }

  const findings: EngineFinding[] = [...emails].slice(0, 30).map((email) => ({
    tool: 'theHarvester',
    findingType: 'osint',
    severity: 'info',
    title: `Email discovered: ${email}`,
    description: `theHarvester found ${email} for ${ctx.domain}.`,
    rawData: { email, domain: ctx.domain },
  }));

  return { findings, engine: 'theHarvester' };
}
