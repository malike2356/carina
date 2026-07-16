import { commandExists, runCommand } from './exec-tool.js';
import type { EngineFinding } from './types.js';

interface CrtShEntry {
  name_value?: string;
}

async function fetchCrtShSubdomains(domain: string): Promise<string[]> {
  const url = `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return [];
  const rows = await res.json() as CrtShEntry[];
  const names = new Set<string>();
  for (const row of rows) {
    const raw = row.name_value ?? '';
    for (const part of raw.split('\n')) {
      const name = part.trim().toLowerCase().replace(/^\*\./, '');
      if (name.endsWith(`.${domain}`) || name === domain) {
        names.add(name);
      }
    }
  }
  return [...names].sort().slice(0, 50);
}

async function runAmassSubdomains(domain: string): Promise<string[]> {
  const { stdout } = await runCommand(
    'amass',
    ['enum', '-passive', '-d', domain, '-silent'],
    120_000,
  );
  return stdout
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.endsWith(domain))
    .slice(0, 50);
}

export async function runSubdomainScan(domain: string): Promise<{
  subdomains: string[];
  findings: EngineFinding[];
  engine: string;
}> {
  let subdomains: string[] = [];
  let engine = 'crt.sh';

  if (await commandExists('amass')) {
    subdomains = await runAmassSubdomains(domain);
    engine = 'amass';
  }
  if (subdomains.length === 0) {
    subdomains = await fetchCrtShSubdomains(domain);
  }

  const findings: EngineFinding[] = subdomains.map((sub) => ({
    tool: 'amass',
    findingType: 'subdomain',
    severity: 'info',
    title: `Subdomain discovered: ${sub}`,
    description: `Passive subdomain enumeration found ${sub}.`,
    rawData: { subdomain: sub, parent: domain },
  }));

  return { subdomains, findings, engine };
}
