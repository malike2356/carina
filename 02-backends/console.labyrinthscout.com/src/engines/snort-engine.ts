import fs from 'node:fs/promises';
import { skippedResult } from './parse-helpers.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

const SNORT_LOG = process.env.SCOUT_SNORT_LOG ?? '';

export async function runSnortScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!SNORT_LOG) return skippedResult('snort');

  let content: string;
  try {
    content = await fs.readFile(SNORT_LOG, 'utf8');
  } catch {
    return skippedResult('snort');
  }

  const findings: EngineFinding[] = [];
  const lines = content.split('\n').slice(-200);
  for (const line of lines) {
    if (!line.toLowerCase().includes(ctx.domain) && !line.includes(ctx.host)) continue;
    if (!/alert|drop|reject/i.test(line)) continue;
    findings.push({
      tool: 'snort',
      findingType: 'ids_alert',
      severity: 'high',
      title: `Snort alert for ${ctx.domain}`,
      description: line.trim().slice(0, 500),
      rawData: { line: line.trim(), logPath: SNORT_LOG },
    });
  }

  return { findings: findings.slice(0, 30), engine: 'snort' };
}
