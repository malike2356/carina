import { commandExists, runCommand } from './exec-tool.js';
import { mapSeverity, skippedResult } from './parse-helpers.js';
import { targetUrl, type ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

interface WpscanPlugin {
  slug?: string;
  version?: { number?: string };
  vulnerabilities?: Record<string, { title?: string; severity?: string }>;
}

interface WpscanResult {
  version?: { number?: string };
  plugins?: Record<string, WpscanPlugin>;
  main_theme?: { version?: { number?: string } };
}

export async function runWpscanScan(ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!(await commandExists('wpscan'))) return skippedResult('wpscan');

  const url = targetUrl(ctx.domain);
  const { stdout, exitCode } = await runCommand(
    'wpscan',
    ['--url', url, '--enumerate', 'vp', '--format', 'json', '--disable-tls-checks', '--max-threads', '5'],
    300_000,
  );

  if (exitCode !== 0 && !stdout.trim()) return skippedResult('wpscan');

  let data: WpscanResult = {};
  try {
    data = JSON.parse(stdout) as WpscanResult;
  } catch {
    return { findings: [], engine: 'wpscan' };
  }

  const findings: EngineFinding[] = [];
  if (data.version?.number) {
    findings.push({
      tool: 'wpscan',
      findingType: 'tech_stack',
      severity: 'info',
      title: `WordPress ${data.version.number} detected`,
      description: `WPScan identified WordPress on ${ctx.domain}.`,
      rawData: { version: data.version.number },
    });
  }

  for (const plugin of Object.values(data.plugins ?? {})) {
    for (const vuln of Object.values(plugin.vulnerabilities ?? {})) {
      const severity = mapSeverity(vuln.severity);
      if (severity === 'info') continue;
      findings.push({
        tool: 'wpscan',
        findingType: 'cve',
        severity,
        title: vuln.title ?? `Vulnerability in ${plugin.slug ?? 'plugin'}`,
        description: vuln.title,
        rawData: { plugin: plugin.slug, version: plugin.version?.number },
      });
    }
  }

  return { findings: findings.slice(0, 50), engine: 'wpscan' };
}
