import { commandExists, runCommand } from './exec-tool.js';
import { skippedResult } from './parse-helpers.js';
import { COMMON_PATHS, COMMON_VHOSTS } from './wordlists.js';
import { targetUrl, type ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

async function probePaths(domain: string, paths: string[]): Promise<EngineFinding[]> {
  const findings: EngineFinding[] = [];
  const base = targetUrl(domain);
  for (const path of paths.slice(0, 12)) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status >= 200 && res.status < 400) {
        findings.push({
          tool: 'dirsearch',
          findingType: 'endpoint',
          severity: res.status === 200 ? 'low' : 'info',
          title: `Discovered path ${path} (${res.status})`,
          description: `HTTP ${res.status} on ${base}${path}`,
          rawData: { path, status: res.status, url: `${base}${path}` },
        });
      }
    } catch {
      // unreachable path
    }
  }
  return findings;
}

export async function runDirsearchScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (await commandExists('dirsearch')) {
    const url = targetUrl(ctx.domain);
    const { stdout } = await runCommand(
      'dirsearch',
      ['-u', url, '-e', 'html,php,js', '--format', 'plain', '-t', '10', '--max-time', '90'],
      120_000,
    );
    const findings: EngineFinding[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/(\d{3})\s+(https?:\/\/\S+)/);
      if (!match) continue;
      findings.push({
        tool: 'dirsearch',
        findingType: 'endpoint',
        severity: parseInt(match[1]!, 10) === 200 ? 'low' : 'info',
        title: `Discovered ${match[2]}`,
        description: `dirsearch found HTTP ${match[1]} at ${match[2]}.`,
        rawData: { status: parseInt(match[1]!, 10), url: match[2] },
      });
    }
    if (findings.length > 0) return { findings: findings.slice(0, 40), engine: 'dirsearch' };
  }
  return { findings: await probePaths(ctx.domain, COMMON_PATHS), engine: 'dirsearch:fallback' };
}

export async function runFeroxbusterScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!(await commandExists('feroxbuster'))) {
    return { findings: await probePaths(ctx.domain, COMMON_PATHS.slice(0, 8)), engine: 'feroxbuster:fallback' };
  }
  const url = targetUrl(ctx.domain);
  const { stdout } = await runCommand(
    'feroxbuster',
    ['-u', url, '-q', '-t', '8', '--time-limit', '90s', '--json'],
    120_000,
  );
  const findings: EngineFinding[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const row = JSON.parse(line) as { url?: string; status?: number };
      if (!row.url) continue;
      findings.push({
        tool: 'feroxbuster',
        findingType: 'endpoint',
        severity: row.status === 200 ? 'low' : 'info',
        title: `Feroxbuster: ${row.url}`,
        description: `HTTP ${row.status ?? 'unknown'} at ${row.url}`,
        rawData: row,
      });
    } catch {
      // skip
    }
  }
  return { findings: findings.slice(0, 40), engine: 'feroxbuster' };
}

export async function runGobusterScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (await commandExists('gobuster')) {
    const url = targetUrl(ctx.domain);
    const { stdout } = await runCommand(
      'gobuster',
      ['dir', '-u', url, '-w', '/usr/share/wordlists/dirb/common.txt', '-q', '-t', '10', '--timeout', '10s'],
      120_000,
    );
    const findings: EngineFinding[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/(\/\S+)\s+\(Status:\s*(\d+)\)/);
      if (!match) continue;
      findings.push({
        tool: 'gobuster',
        findingType: 'endpoint',
        severity: parseInt(match[2]!, 10) === 200 ? 'low' : 'info',
        title: `Gobuster: ${match[1]}`,
        rawData: { path: match[1], status: parseInt(match[2]!, 10) },
      });
    }
    if (findings.length > 0) return { findings: findings.slice(0, 40), engine: 'gobuster' };
  }
  return { findings: await probePaths(ctx.domain, COMMON_PATHS.slice(0, 6)), engine: 'gobuster:fallback' };
}

export async function runFfufScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!(await commandExists('ffuf'))) {
    return { findings: [], engine: 'ffuf:skipped' };
  }
  const url = `${targetUrl(ctx.domain)}/FUZZ`;
  const { stdout } = await runCommand(
    'ffuf',
    ['-u', url, '-w', '/usr/share/wordlists/dirb/common.txt', '-mc', '200,301,302,403', '-of', 'json', '-t', '10'],
    120_000,
  );
  const findings: EngineFinding[] = [];
  try {
    const data = JSON.parse(stdout) as { results?: Array<{ url?: string; status?: number }> };
    for (const row of data.results ?? []) {
      if (!row.url) continue;
      findings.push({
        tool: 'ffuf',
        findingType: 'endpoint',
        severity: row.status === 200 ? 'low' : 'info',
        title: `ffuf: ${row.url}`,
        rawData: row,
      });
    }
  } catch {
    // no json output
  }
  return { findings: findings.slice(0, 40), engine: 'ffuf' };
}

export async function runArjunScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!(await commandExists('arjun'))) return skippedResult('arjun');
  const url = targetUrl(ctx.domain);
  const { stdout } = await runCommand(
    'arjun',
    ['-u', url, '-oJ', '/dev/stdout', '-t', '10', '--stable'],
    120_000,
  );
  const findings: EngineFinding[] = [];
  try {
    const rows = JSON.parse(stdout) as Array<{ params?: string[]; url?: string }>;
    for (const row of rows) {
      for (const param of row.params ?? []) {
        findings.push({
          tool: 'arjun',
          findingType: 'endpoint',
          severity: 'info',
          title: `Hidden parameter: ${param}`,
          description: `Arjun discovered parameter ${param} on ${row.url ?? url}.`,
          rawData: { param, url: row.url ?? url },
        });
      }
    }
  } catch {
    for (const line of stdout.split('\n')) {
      const match = line.match(/parameter[:\s]+(\w+)/i);
      if (match) {
        findings.push({
          tool: 'arjun',
          findingType: 'endpoint',
          severity: 'info',
          title: `Hidden parameter: ${match[1]}`,
          rawData: { param: match[1] },
        });
      }
    }
  }
  return { findings: findings.slice(0, 30), engine: 'arjun' };
}

export async function runVhostScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  const findings: EngineFinding[] = [];
  const host = ctx.host;
  for (const prefix of COMMON_VHOSTS) {
    const vhost = `${prefix}.${ctx.domain}`;
    try {
      const res = await fetch(targetUrl(ctx.domain), {
        method: 'HEAD',
        headers: { Host: vhost },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status < 500) {
        findings.push({
          tool: 'gobuster',
          findingType: 'subdomain',
          severity: 'info',
          title: `Virtual host candidate: ${vhost}`,
          description: `Host header ${vhost} returned HTTP ${res.status}.`,
          rawData: { vhost, status: res.status, ip: host },
        });
      }
    } catch {
      // skip
    }
  }
  return { findings, engine: 'gobuster:vhost' };
}
