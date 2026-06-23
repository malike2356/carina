import {
  getConfig,
  investigationDataFromScoutFinding,
  onInvestigationOpened,
  onTargetDiscovered,
  onToolCompleted,
  slugifyCaseId,
  type TargetData,
} from './obsidian-vault.js';
import {
  getActiveInvestigationContext,
  setActiveInvestigationContext,
  updateInvestigation,
} from './scout-investigations.js';
import type { ScoutFinding, ScoutInvestigation } from './scout-findings-types.js';

const CYBER_TOOL_NAMES = [
  'nmap', 'nuclei', 'metasploit', 'nikto', 'ffuf', 'amass', 'hydra', 'sqlmap',
  'burpsuite', 'masscan', 'wpscan', 'gobuster', 'dirb', 'hashcat', 'john',
  'volatility3', 'volatility', 'yara', 'wireshark', 'impacket', 'bettercap',
  'aircrack-ng', 'bloodhound', 'snort', 'ghidra', 'autopsy', 'cyberchef',
];

const INVESTIGATION_CARINA_TOOLS = new Set([
  'shell-exec',
  'http-request',
  'web-search',
  'secrets-audit',
  'capabilities-audit',
  'file-read',
  'file-write',
]);

export interface ScoutObsidianToolEvent {
  toolName: string;
  params: Record<string, unknown>;
  result: string;
  durationMs: number;
  sessionId?: string;
}

export interface ScoutObsidianOpenResult {
  caseId: string;
  casePath: string;
}

export function isObsidianBridgeEnabled(): boolean {
  if (process.env.OBSIDIAN_INTEGRATION === 'false') return false;
  const config = getConfig();
  return config.autoGenerate.investigations || config.autoGenerate.evidence;
}

export async function openScoutInvestigationInObsidian(
  investigation: ScoutInvestigation,
  finding: ScoutFinding,
  opts?: { org?: string; sessionId?: string },
): Promise<ScoutObsidianOpenResult | null> {
  if (!isObsidianBridgeEnabled()) return null;

  const caseId = slugifyCaseId(finding.title);
  const data = investigationDataFromScoutFinding(finding, {
    org: opts?.org,
    caseId,
  });

  const casePath = await onInvestigationOpened(data);
  if (!casePath) return null;

  await updateInvestigation(investigation.id, {
    obsidianCaseId: caseId,
    obsidianCasePath: casePath,
    status: 'in_progress',
  });

  await setActiveInvestigationContext({
    investigationId: investigation.id,
    findingId: finding.id,
    caseId,
    casePath,
    targetId: finding.targetId,
    org: data.org,
    openedAt: investigation.openedAt,
    sessionId: opts?.sessionId,
  });

  return { caseId, casePath };
}

export async function notifyScoutObsidianToolCompleted(
  event: ScoutObsidianToolEvent,
): Promise<string | null> {
  if (!isObsidianBridgeEnabled()) return null;

  const context = await getActiveInvestigationContext();
  if (!context) return null;

  const resolved = resolveObsidianTool(event.toolName, event.params);
  if (!resolved) return null;

  const target = extractTarget(event.params, context.targetId);
  const output = truncateOutput(event.result);
  const scanType = resolved.scanType;

  const evidencePath = await onToolCompleted({
    caseId: context.caseId,
    casePath: context.casePath,
    tool: resolved.tool,
    scanType,
    scanId: `${resolved.tool}_${Date.now()}`,
    target,
    output,
    status: 'completed',
    durationSeconds: Math.max(0, event.durationMs / 1000),
  });

  const targetData = buildTargetDataFromToolOutput(target, event.params, event.result);
  if (Object.keys(targetData).length > 0) {
    await onTargetDiscovered(target, {
      ...targetData,
      domain: target,
      investigations: [context.caseId],
    });
  }

  return evidencePath;
}

export function resolveObsidianTool(
  toolName: string,
  params: Record<string, unknown>,
): { tool: string; scanType: string } | null {
  const normalized = toolName.toLowerCase();
  if (CYBER_TOOL_NAMES.includes(normalized)) {
    return {
      tool: normalized,
      scanType: String(params.scanType ?? params.scan_type ?? params.action ?? 'run'),
    };
  }

  if (normalized === 'shell-exec') {
    const command = String(params.command ?? params.cmd ?? '').toLowerCase();
    for (const cyberTool of CYBER_TOOL_NAMES) {
      if (command.includes(cyberTool)) {
        return {
          tool: cyberTool,
          scanType: inferScanTypeFromCommand(command, cyberTool),
        };
      }
    }
  }

  if (INVESTIGATION_CARINA_TOOLS.has(normalized)) {
    return {
      tool: normalized,
      scanType: String(params.method ?? params.action ?? params.operation ?? 'run'),
    };
  }

  if (/report|forensic|audit|security|recon|vuln|exploit|scan/i.test(normalized)) {
    return { tool: normalized, scanType: 'report' };
  }

  return null;
}

export function extractTarget(
  params: Record<string, unknown>,
  fallback?: string,
): string {
  for (const key of ['target', 'host', 'domain', 'hostname', 'url', 'address']) {
    const value = params[key];
    if (typeof value === 'string' && value.trim()) {
      return sanitizeTarget(value);
    }
  }

  const command = String(params.command ?? params.cmd ?? '');
  const hostMatch = command.match(
    /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/i,
  );
  if (hostMatch?.[0]) return sanitizeTarget(hostMatch[0]);

  const ipMatch = command.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  if (ipMatch?.[0]) return ipMatch[0];

  return fallback ?? 'unknown';
}

export function buildTargetDataFromToolOutput(
  target: string,
  params: Record<string, unknown>,
  result: string,
): TargetData {
  const data: TargetData = { domain: target };

  const ips = new Set<string>();
  for (const match of result.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
    ips.add(match[0]!);
  }
  if (ips.size > 0) data.ips = [...ips];

  const openPorts: Record<number, string> = {};
  for (const match of result.matchAll(/(\d+)\/tcp\s+open\s+(\S+)/gi)) {
    openPorts[Number(match[1])] = match[2]!;
  }
  for (const match of result.matchAll(/(\d+)\/udp\s+open\s+(\S+)/gi)) {
    openPorts[Number(match[1])] = match[2]!;
  }
  if (Object.keys(openPorts).length > 0) data.openPorts = openPorts;

  const techStack = new Set<string>();
  for (const match of result.matchAll(/\b(?:nginx|apache|openssl|php|mysql|postgres|redis|openssh)\/[\d.]+/gi)) {
    techStack.add(match[0]!.toLowerCase());
  }
  if (techStack.size > 0) data.techStack = [...techStack];

  const targetParam = extractTarget(params, target);
  if (targetParam !== 'unknown') data.domain = targetParam;

  return data;
}

function inferScanTypeFromCommand(command: string, tool: string): string {
  if (command.includes('-sv') || command.includes('service')) return 'service';
  if (command.includes('-ss') || command.includes('syn')) return 'syn';
  if (command.includes('validate') || command.includes('exploit')) return 'validate';
  if (tool === 'nuclei') return 'template';
  if (tool === 'ffuf') return 'fuzz';
  return 'run';
}

function sanitizeTarget(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

function truncateOutput(result: string, max = 50_000): string {
  if (result.length <= max) return result;
  return `${result.slice(0, max)}\n\n...(truncated)`;
}
