import { commandExists, runCommand } from './exec-tool.js';
import type { EngineFinding } from './types.js';

type NucleiLine = {
  'template-id'?: string;
  info?: { name?: string; severity?: string; description?: string };
  'matched-at'?: string;
  host?: string;
  ip?: string;
};

function mapNucleiSeverity(raw?: string): EngineFinding['severity'] {
  const s = (raw ?? 'info').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

function parseNucleiLines(output: string, target: string): EngineFinding[] {
  const findings: EngineFinding[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const row = JSON.parse(trimmed) as NucleiLine;
      const templateId = row['template-id'] ?? 'unknown';
      const name = row.info?.name ?? templateId;
      const severity = mapNucleiSeverity(row.info?.severity);
      if (severity !== 'critical' && severity !== 'high' && severity !== 'medium') continue;
      findings.push({
        tool: 'nuclei',
        findingType: 'cve',
        severity,
        title: name,
        description: row.info?.description ?? `Nuclei template ${templateId} matched on ${target}.`,
        cvssScore: severity === 'critical' ? 9.0 : severity === 'high' ? 7.5 : 5.0,
        rawData: {
          templateId,
          matchedAt: row['matched-at'],
          host: row.host ?? target,
        },
      });
    } catch {
      // skip malformed lines
    }
  }
  return findings;
}

export async function runNucleiScan(domain: string): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!(await commandExists('nuclei'))) {
    return { findings: [], engine: 'skipped' };
  }

  const urls = [`https://${domain}`, `http://${domain}`];
  const all: EngineFinding[] = [];

  for (const url of urls) {
    const { stdout, stderr } = await runCommand(
      'nuclei',
      ['-u', url, '-severity', 'critical,high,medium', '-silent', '-jsonl'],
      180_000,
    );
    all.push(...parseNucleiLines(`${stdout}\n${stderr}`, domain));
  }

  return { findings: all.slice(0, 100), engine: 'nuclei' };
}
