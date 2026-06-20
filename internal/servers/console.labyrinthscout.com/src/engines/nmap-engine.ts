import { commandExists, runCommand } from './exec-tool.js';
import { probeTopPorts, portFindings } from './port-probe.js';
import type { EngineFinding } from './types.js';

const NMAP_PORT_RE = /^(\d+)\/tcp\s+open(?:\s+(\S+))?/gm;

function parseNmapOutput(output: string, target: string): { openPorts: number[]; findings: EngineFinding[] } {
  const openPorts: number[] = [];
  const findings: EngineFinding[] = [];
  let match: RegExpExecArray | null;
  NMAP_PORT_RE.lastIndex = 0;
  while ((match = NMAP_PORT_RE.exec(output)) !== null) {
    const port = parseInt(match[1]!, 10);
    if (!Number.isFinite(port)) continue;
    openPorts.push(port);
    const service = match[2] ?? 'unknown';
    findings.push({
      tool: 'nmap',
      findingType: 'open_port',
      severity: 'info',
      title: `Open port ${port}/${service} on ${target}`,
      description: `Nmap detected ${service} on TCP port ${port}.`,
      rawData: { port, protocol: 'tcp', service, host: target },
    });
  }
  return { openPorts, findings };
}

export async function runNmapScan(host: string, target: string): Promise<{
  openPorts: number[];
  findings: EngineFinding[];
  engine: string;
}> {
  if (await commandExists('nmap')) {
    const { stdout, stderr, exitCode } = await runCommand(
      'nmap',
      ['-T4', '--top-ports', '100', '-Pn', host],
      180_000,
    );
    const parsed = parseNmapOutput(`${stdout}\n${stderr}`, target);
    if (parsed.openPorts.length > 0 || exitCode === 0) {
      return { ...parsed, engine: 'nmap' };
    }
  }

  const openPorts = await probeTopPorts(host);
  return {
    openPorts,
    findings: portFindings(openPorts, target),
    engine: 'port-probe',
  };
}
