import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import { targetUrl, type ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

function parseNiktoOutput(output: string, domain: string): EngineFinding[] {
  const findings: EngineFinding[] = [];
  for (const line of output.split('\n')) {
    if (!line.includes('OSVDB') && !line.includes('+') && !line.toLowerCase().includes('vulnerability')) {
      continue;
    }
    const trimmed = line.replace(/^\+\s*/, '').trim();
    if (trimmed.length < 10) continue;
    findings.push({
      tool: 'nikto',
      findingType: 'misconfig',
      severity: trimmed.toLowerCase().includes('osvdb') ? 'medium' : 'low',
      title: `Nikto: ${trimmed.slice(0, 120)}`,
      description: trimmed,
      rawData: { line: trimmed, host: domain },
    });
  }
  return findings.slice(0, 50);
}

export async function runNiktoScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!(await commandExists('nikto'))) return skippedResult('nikto');

  const url = targetUrl(ctx.domain);
  const { stdout, stderr } = await runCommand(
    'nikto',
    ['-h', url, '-Tuning', 'x', '-maxtime', '120s'],
    180_000,
  );

  return { findings: parseNiktoOutput(`${stdout}\n${stderr}`, ctx.domain), engine: 'nikto' };
}
