import { commandExists, runCommand } from './exec-tool.js';
import type { EngineFinding } from './types.js';

async function fetchHeaders(domain: string): Promise<{
  techStack: string[];
  findings: EngineFinding[];
}> {
  const techStack: string[] = [];
  const findings: EngineFinding[] = [];

  for (const scheme of ['https', 'http']) {
    const url = `${scheme}://${domain}`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });
      const server = res.headers.get('server');
      const powered = res.headers.get('x-powered-by');
      if (server) techStack.push(server);
      if (powered) techStack.push(powered);
      if (server || powered) {
        findings.push({
          tool: 'whatweb',
          findingType: 'tech_stack',
          severity: 'info',
          title: `Technology fingerprint: ${domain}`,
          description: [server ? `Server: ${server}` : null, powered ? `Powered-By: ${powered}` : null]
            .filter(Boolean)
            .join('; '),
          rawData: { url, server, poweredBy: powered, status: res.status },
        });
      }
      break;
    } catch {
      // try next scheme
    }
  }

  return { techStack, findings };
}

function parseWhatwebOutput(output: string, domain: string): {
  techStack: string[];
  findings: EngineFinding[];
} {
  const techStack: string[] = [];
  const findings: EngineFinding[] = [];
  for (const line of output.split('\n')) {
    const match = line.match(/https?:\/\/\S+\s+\[(.+)\]/);
    if (!match) continue;
    const plugins = match[1]!.split(',').map((p) => p.trim()).filter(Boolean);
    techStack.push(...plugins);
    findings.push({
      tool: 'whatweb',
      findingType: 'tech_stack',
      severity: 'info',
      title: `WhatWeb fingerprint: ${domain}`,
      description: plugins.join(', '),
      rawData: { plugins, domain },
    });
  }
  return { techStack, findings };
}

export async function runTechFingerprint(domain: string): Promise<{
  techStack: string[];
  findings: EngineFinding[];
  engine: string;
}> {
  if (await commandExists('whatweb')) {
    const { stdout } = await runCommand(
      'whatweb',
      ['--no-errors', '-a', '3', `https://${domain}`, `http://${domain}`],
      90_000,
    );
    const parsed = parseWhatwebOutput(stdout, domain);
    if (parsed.findings.length > 0) {
      return { ...parsed, techStack: [...new Set(parsed.techStack)], engine: 'whatweb' };
    }
  }

  const fallback = await fetchHeaders(domain);
  return {
    techStack: [...new Set(fallback.techStack)],
    findings: fallback.findings,
    engine: 'whatweb:fallback',
  };
}
