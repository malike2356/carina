import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

export async function runBloodhoundScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (ctx.targetType !== 'domain') return skippedResult('bloodhound');
  if (!(await commandExists('bloodhound-python'))) return skippedResult('bloodhound');

  const { stdout, exitCode } = await runCommand(
    'bloodhound-python',
    ['-d', ctx.domain, '-c', 'Group', '--zip'],
    300_000,
  );

  if (exitCode !== 0) return skippedResult('bloodhound');

  return {
    findings: [{
      tool: 'bloodhound',
      findingType: 'ad_mapping',
      severity: 'info',
      title: `BloodHound collection queued for ${ctx.domain}`,
      description: 'bloodhound-python completed a collection run. Import the ZIP into BloodHound GUI for path analysis.',
      rawData: { domain: ctx.domain, output: stdout.slice(0, 1000) },
    }],
    engine: 'bloodhound',
  };
}
