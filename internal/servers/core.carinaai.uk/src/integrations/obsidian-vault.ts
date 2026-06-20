import fsp from 'fs/promises';
import path from 'path';
import { expandPath } from '../tools/path-utils.js';
import type { ScoutFinding } from './scout-findings-types.js';

export type InvestigationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ObsidianConfig {
  vaultPath: string;
  operatorName: string;
  autoGenerate: {
    investigations: boolean;
    evidence: boolean;
    targets: boolean;
    dailyLog: boolean;
  };
}

export interface InvestigationData {
  caseId: string;
  title: string;
  severity: InvestigationSeverity;
  cvss: number;
  scoutFindingId?: string;
  tags: string[];
  targets: string[];
  org: string;
}

export interface EvidenceData {
  caseId: string;
  casePath: string;
  tool: string;
  scanType: string;
  scanId: string;
  target: string;
  output: string;
  status: 'completed' | 'failed';
  durationSeconds: number;
  artifacts?: string[];
}

export interface TargetData {
  domain?: string;
  ips?: string[];
  owner?: string;
  techStack?: string[];
  openPorts?: Record<number, string>;
  tags?: string[];
  org?: string;
  investigations?: string[];
  first_seen?: string;
}

export interface VaultStats {
  openInvestigations: number;
  closedInvestigations: number;
  targetsMonitored: number;
  evidenceFiles: number;
  totalCaseNotes: number;
  vaultSizeBytes: number;
}

const TOOL_CATALOG: Array<{ name: string; category: string; risk: string; scout: boolean }> = [
  { name: 'nmap', category: 'Recon', risk: 'Medium', scout: true },
  { name: 'nuclei', category: 'Vuln Scan', risk: 'Medium', scout: true },
  { name: 'amass', category: 'Recon', risk: 'Medium', scout: true },
  { name: 'metasploit', category: 'Exploitation', risk: 'Critical', scout: false },
  { name: 'impacket', category: 'Exploitation', risk: 'High', scout: false },
  { name: 'hydra', category: 'Exploitation', risk: 'High', scout: false },
  { name: 'john', category: 'Password Crack', risk: 'Medium', scout: false },
  { name: 'hashcat', category: 'Password Crack', risk: 'Medium', scout: false },
  { name: 'burpsuite', category: 'Web Testing', risk: 'Medium', scout: false },
  { name: 'ffuf', category: 'Web Testing', risk: 'Medium', scout: true },
  { name: 'wireshark', category: 'Traffic Analysis', risk: 'Low', scout: false },
  { name: 'volatility3', category: 'Forensics', risk: 'Low', scout: false },
  { name: 'autopsy', category: 'Forensics', risk: 'Low', scout: false },
  { name: 'yara', category: 'Forensics', risk: 'Low', scout: true },
  { name: 'bloodhound', category: 'Blue Team', risk: 'Medium', scout: true },
  { name: 'snort', category: 'Blue Team', risk: 'Low', scout: true },
  { name: 'ghidra', category: 'Reverse Eng', risk: 'Low', scout: false },
  { name: 'aircrack-ng', category: 'Wireless', risk: 'High', scout: false },
  { name: 'bettercap', category: 'Wireless', risk: 'High', scout: false },
  { name: 'cyberchef', category: 'Reporting', risk: 'Low', scout: true },
];

const targetWriteLocks = new Map<string, Promise<void>>();

export function resolveVaultPath(raw?: string): string {
  const value = raw ?? process.env.OBSIDIAN_VAULT_PATH ?? path.join('~', 'Documents', 'Obsidian Vault');
  const expanded = expandPath(value.replace(/^\$HOME\//, '~/'));
  return path.resolve(expanded);
}

export function getConfig(): ObsidianConfig {
  return {
    vaultPath: resolveVaultPath(),
    operatorName: process.env.CARINA_OPERATOR ?? 'operator',
    autoGenerate: {
      investigations: process.env.OBSIDIAN_AUTO_INVESTIGATIONS !== 'false',
      evidence: process.env.OBSIDIAN_AUTO_EVIDENCE !== 'false',
      targets: process.env.OBSIDIAN_AUTO_TARGETS !== 'false',
      dailyLog: process.env.OBSIDIAN_AUTO_DAILY_LOG !== 'false',
    },
  };
}

export function isObsidianConfigured(): boolean {
  return Boolean(process.env.OBSIDIAN_VAULT_PATH);
}

export function slugifyCaseId(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'case';
}

export function investigationDataFromScoutFinding(
  finding: ScoutFinding,
  opts?: { org?: string; caseId?: string },
): InvestigationData {
  return {
    caseId: opts?.caseId ?? slugifyCaseId(finding.title),
    title: finding.title,
    severity: finding.severity,
    cvss: finding.cvssScore ?? 0,
    scoutFindingId: finding.id,
    tags: [finding.tool, finding.findingType, finding.severity],
    targets: [finding.targetId],
    org: opts?.org ?? finding.accountId,
  };
}

function monthFolder(date: Date): string {
  const month = date.toLocaleString('en', { month: 'short' });
  return `${date.getMonth() + 1}-${month}`;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

async function withTargetLock<T>(targetName: string, fn: () => Promise<T>): Promise<T> {
  const prev = targetWriteLocks.get(targetName) ?? Promise.resolve();
  let result!: T;
  const next = prev.then(async () => {
    result = await fn();
  });
  targetWriteLocks.set(targetName, next.then(() => undefined, () => undefined));
  await next;
  return result;
}

export async function bootstrapVault(config: ObsidianConfig = getConfig()): Promise<void> {
  const vp = config.vaultPath;
  for (const dir of ['Investigations', 'Targets', 'Tools', 'Templates', 'Playbooks', 'Daily', 'Evidence']) {
    await fsp.mkdir(path.join(vp, dir), { recursive: true });
  }
  await writeDashboard(vp, config);
  await generateToolNotes(vp);
  await writeTemplates(vp, config);
  await writePlaybooks(vp);
}

export async function createInvestigation(
  config: ObsidianConfig,
  data: InvestigationData,
): Promise<string> {
  const now = new Date();
  const casePath = path.join(
    config.vaultPath,
    'Investigations',
    now.getFullYear().toString(),
    monthFolder(now),
    data.caseId,
  );

  await fsp.mkdir(path.join(casePath, 'evidence', 'screenshots'), { recursive: true });
  await fsp.mkdir(path.join(casePath, 'targets'), { recursive: true });
  await fsp.mkdir(path.join(casePath, 'reports'), { recursive: true });

  const frontmatter = `---
type: investigation
case_id: "${escapeYaml(data.caseId)}"
title: "${escapeYaml(data.title)}"
status: active
severity: ${data.severity}
cvss: ${data.cvss}
opened: ${now.toISOString()}
closed:
operator: ${config.operatorName}
org: "${escapeYaml(data.org)}"
scout_finding_id: "${escapeYaml(data.scoutFindingId ?? '')}"
tags:
${data.tags.map((t) => `  - ${t}`).join('\n') || '  []'}
targets:
${data.targets.map((t) => `  - "[[../Targets/${t}]]"`).join('\n') || '  []'}
tools_used:
sessions:
evidence_count: 0
linked_cases:
---`;

  const body = `
# ${data.title}

## Summary
- **Severity:** ${data.severity.toUpperCase()} (CVSS ${data.cvss})
- **Opened:** ${now.toISOString()}
- **Organization:** ${data.org}
- **Scout Finding:** \`${data.scoutFindingId ?? 'N/A'}\`

## Targets
${data.targets.map((t) => `- [[../Targets/${t}|${t}]]`).join('\n') || '*None yet*'}

## Timeline
| Time | Event |
|------|-------|
| ${now.toISOString()} | Investigation opened |

## Evidence
*No evidence collected yet.*

## Tools Used
*None yet.*

## Notes
`;

  await fsp.writeFile(path.join(casePath, 'index.md'), `${frontmatter}\n${body}`);
  await fsp.writeFile(
    path.join(casePath, 'timeline.md'),
    `# Timeline; ${data.caseId}\n\n| Time | Event |\n|------|-------|\n| ${now.toISOString()} | Investigation opened |\n`,
  );

  for (const target of data.targets) {
    await upsertTarget(config, target, {
      tags: data.tags,
      org: data.org,
      investigations: [data.caseId],
      domain: target,
    });
  }

  return casePath;
}

export async function closeInvestigation(
  config: ObsidianConfig,
  caseId: string,
): Promise<string> {
  const casePath = await findCasePath(config, caseId);
  if (!casePath) {
    throw new Error(`Investigation not found: ${caseId}`);
  }
  const indexPath = path.join(casePath, 'index.md');
  const content = await fsp.readFile(indexPath, 'utf-8');
  const closedAt = new Date().toISOString();
  const updated = content
    .replace(/^status: active/m, 'status: closed')
    .replace(/^closed:\s*$/m, `closed: ${closedAt}`);
  await fsp.writeFile(indexPath, updated);
  await appendTimeline(casePath, `${closedAt} | Investigation closed`);
  return casePath;
}

export async function addEvidence(
  config: ObsidianConfig,
  data: EvidenceData,
): Promise<string> {
  const casePath = data.casePath || (await findCasePath(config, data.caseId));
  if (!casePath) {
    throw new Error(`Investigation not found: ${data.caseId}`);
  }

  const evidenceDir = path.join(casePath, 'evidence');
  await fsp.mkdir(evidenceDir, { recursive: true });
  const filename = `${data.tool}-${data.scanType}.md`;
  const evidencePath = path.join(evidenceDir, filename);

  const frontmatter = `---
type: evidence
investigation: "[[../index]]"
tool: ${data.tool}
scan_type: ${data.scanType}
scan_id: "${escapeYaml(data.scanId)}"
target: "${escapeYaml(data.target)}"
duration_seconds: ${data.durationSeconds}
status: ${data.status}
artifacts:
${(data.artifacts ?? []).map((a) => `  - "${a}"`).join('\n') || '  []'}
---`;

  const body = `
# ${data.tool}; ${data.scanType}

**Target:** [[../../Targets/${data.target}|${data.target}]]
**Duration:** ${data.durationSeconds}s
**Status:** ${data.status}

## Output

${data.output}
`;

  await fsp.writeFile(evidencePath, `${frontmatter}\n${body}`);
  await appendToInvestigation(casePath, data.tool);
  return evidencePath;
}

export async function upsertTarget(
  config: ObsidianConfig,
  targetName: string,
  data: TargetData,
): Promise<string> {
  return withTargetLock(targetName, async () => {
    const targetPath = path.join(config.vaultPath, 'Targets', `${targetName}.md`);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    const now = new Date().toISOString().slice(0, 10);

    let existing: TargetData = {};
    try {
      const content = await fsp.readFile(targetPath, 'utf-8');
      existing = parseFrontmatter(content) as TargetData;
    } catch {
      // new target
    }

    const merged: TargetData = {
      ...existing,
      ...data,
      domain: data.domain ?? existing.domain ?? targetName,
      ips: [...new Set([...(existing.ips ?? []), ...(data.ips ?? [])])],
      techStack: [...new Set([...(existing.techStack ?? []), ...(data.techStack ?? [])])],
      openPorts: { ...(existing.openPorts ?? {}), ...(data.openPorts ?? {}) },
      investigations: [...new Set([...(existing.investigations ?? []), ...(data.investigations ?? [])])],
      tags: [...new Set([...(existing.tags ?? []), ...(data.tags ?? [])])],
    };

    const invLinks = (merged.investigations ?? [])
      .map((id) => `  - "[[../Investigations/*/${id}/index|${id}]]"`)
      .join('\n');

    const frontmatter = `---
type: target
domain: "${escapeYaml(merged.domain ?? targetName)}"
ips:
${(merged.ips ?? []).map((ip) => `  - ${ip}`).join('\n') || '  []'}
owner: "${escapeYaml(merged.owner ?? merged.org ?? '')}"
tech_stack:
${(merged.techStack ?? []).map((t) => `  - ${t}`).join('\n') || '  []'}
open_ports:
${Object.entries(merged.openPorts ?? {}).map(([p, s]) => `  ${p}: ${s}`).join('\n') || '  {}'}
first_seen: ${existing.first_seen ?? now}
last_scanned: ${now}
investigations:
${invLinks || '  []'}
tags:
${(merged.tags ?? []).map((t) => `  - ${t}`).join('\n') || '  []'}
---`;

    const body = `
# ${targetName}

| Field | Value |
|-------|-------|
| Domain | ${merged.domain ?? '-'} |
| IPs | ${(merged.ips ?? []).join(', ') || '-'} |
| Owner | ${merged.owner ?? merged.org ?? '-'} |
| Tech Stack | ${(merged.techStack ?? []).join(', ') || '-'} |

## Open Ports
${Object.entries(merged.openPorts ?? {}).map(([p, s]) => `- **${p}:** ${s}`).join('\n') || '*None discovered*'}

## Investigations
${(merged.investigations ?? []).map((id) => `- [[${id}]]`).join('\n') || '*No investigations yet*'}
`;

    await fsp.writeFile(targetPath, `${frontmatter}\n${body}`);
    return targetPath;
  });
}

export async function appendDailyLog(
  config: ObsidianConfig,
  entries: {
    investigations: string[];
    toolsRun: number;
    findingsConfirmed: number;
    notes?: string;
  },
): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const logDir = path.join(config.vaultPath, 'Daily', now.getFullYear().toString(), monthFolder(now));
  const logPath = path.join(logDir, `${dateStr}.md`);
  await fsp.mkdir(logDir, { recursive: true });

  let mergedInvestigations = [...entries.investigations];
  let toolsRun = entries.toolsRun;
  let findingsConfirmed = entries.findingsConfirmed;

  try {
    const existing = await fsp.readFile(logPath, 'utf-8');
    const parsed = parseFrontmatter(existing) as Record<string, unknown>;
    const prevInv = Array.isArray(parsed.investigations_touched)
      ? parsed.investigations_touched as string[]
      : [];
    mergedInvestigations = [...new Set([...prevInv, ...entries.investigations])];
    toolsRun = Number(parsed.tools_run ?? 0) + entries.toolsRun;
    findingsConfirmed = Number(parsed.findings_confirmed ?? 0) + entries.findingsConfirmed;
  } catch {
    // new log
  }

  const invLinks = mergedInvestigations
    .map((id) => `- [[../Investigations/*/${id}/index|${id}]]`)
    .join('\n');

  const frontmatter = `---
type: daily-log
date: ${dateStr}
operator: ${config.operatorName}
investigations_touched:
${mergedInvestigations.map((id) => `  - "${id}"`).join('\n') || '  []'}
tools_run: ${toolsRun}
findings_confirmed: ${findingsConfirmed}
---`;

  const body = `
# ${dateStr}

## Summary
- **Tools Run:** ${toolsRun}
- **Findings Confirmed:** ${findingsConfirmed}
${entries.notes ? `\n**Notes:** ${entries.notes}\n` : ''}

## Investigations Touched
${invLinks || '*None*'}
`;

  await fsp.writeFile(logPath, `${frontmatter}\n${body}`);
  return logPath;
}

export async function writeDashboard(vp: string, config: ObsidianConfig): Promise<void> {
  const stats = await collectVaultStats(path.resolve(vp));
  const content = `---
type: dashboard
operator: ${config.operatorName}
vault_version: "1.0"
generated: ${new Date().toISOString()}
---

# Carina Security Vault

**Operator:** ${config.operatorName}
**Last Updated:** ${new Date().toISOString()}

## Quick Stats
- Open Investigations: ${stats.openInvestigations}
- Targets Monitored: ${stats.targetsMonitored}
- Tools Available: ${TOOL_CATALOG.length}
- Evidence Files: ${stats.evidenceFiles}

## Recent Investigations
\`\`\`dataview
TABLE severity, status, opened
FROM "Investigations"
WHERE type = "investigation"
SORT opened DESC
LIMIT 10
\`\`\`

## Targets
\`\`\`dataview
TABLE domain, open_ports, last_scanned
FROM "Targets"
WHERE type = "target"
SORT last_scanned DESC
\`\`\`

## Daily Logs
\`\`\`dataview
TABLE tools_run, findings_confirmed
FROM "Daily"
WHERE type = "daily-log"
SORT date DESC
LIMIT 7
\`\`\`

## Quick Actions
- [[Templates/investigation-template|New Investigation]]
- [[Playbooks/web-app-pentest|Web App Pentest Playbook]]
- [[Tools/nmap|Run nmap Scan]]
`;
  await fsp.writeFile(path.join(vp, 'Dashboard.md'), content);
}

export async function findCasePath(config: ObsidianConfig, caseId: string): Promise<string | null> {
  const root = path.join(config.vaultPath, 'Investigations');
  return walkForCase(root, caseId);
}

export async function searchVault(
  config: ObsidianConfig,
  query: string,
): Promise<Array<{ path: string; title: string; type: string }>> {
  const needle = query.toLowerCase();
  const results: Array<{ path: string; title: string; type: string }> = [];
  for (const sub of ['Investigations', 'Targets']) {
    const root = path.join(config.vaultPath, sub);
    await searchMarkdownFiles(root, needle, results);
  }
  return results;
}

export async function getVaultStats(config: ObsidianConfig = getConfig()): Promise<VaultStats> {
  return collectVaultStats(config.vaultPath);
}

export async function onInvestigationOpened(data: InvestigationData): Promise<string> {
  const config = getConfig();
  if (!config.autoGenerate.investigations) return '';
  await bootstrapIfNeeded(config);
  const casePath = await createInvestigation(config, data);
  if (config.autoGenerate.dailyLog) {
    await appendDailyLog(config, {
      investigations: [data.caseId],
      toolsRun: 0,
      findingsConfirmed: 0,
    });
  }
  return casePath;
}

export async function onToolCompleted(data: EvidenceData): Promise<string> {
  const config = getConfig();
  if (!config.autoGenerate.evidence) return '';
  await bootstrapIfNeeded(config);
  return addEvidence(config, data);
}

export async function onTargetDiscovered(target: string, data: TargetData): Promise<string> {
  const config = getConfig();
  if (!config.autoGenerate.targets) return '';
  await bootstrapIfNeeded(config);
  return upsertTarget(config, target, data);
}

async function bootstrapIfNeeded(config: ObsidianConfig): Promise<void> {
  try {
    await fsp.access(path.join(config.vaultPath, 'Dashboard.md'));
  } catch {
    await bootstrapVault(config);
  }
}

async function generateToolNotes(vp: string): Promise<void> {
  const toolsDir = path.join(vp, 'Tools');
  await fsp.mkdir(toolsDir, { recursive: true });
  for (const tool of TOOL_CATALOG) {
    const content = `---
type: tool
name: ${tool.name}
category: ${tool.category}
risk: ${tool.risk}
scout_eligible: ${tool.scout}
---

# ${tool.name}

- **Category:** ${tool.category}
- **Risk Level:** ${tool.risk}
- **Scout (Automated):** ${tool.scout ? 'Yes' : 'No; operator only'}

## Carina Command
\`\`\`bash
carina ${tool.category.toLowerCase().replace(/\s+/g, '-')} <action> <target>
\`\`\`

## When to Use
*See full tool spec in cyber-tools/${tool.name}.md*

## Related Tools
*Cross-links auto-generated from tool category*
`;
    await fsp.writeFile(path.join(toolsDir, `${tool.name}.md`), content);
  }
}

async function writeTemplates(vp: string, config: ObsidianConfig): Promise<void> {
  const tplDir = path.join(vp, 'Templates');
  await fsp.mkdir(tplDir, { recursive: true });

  const templates: Record<string, string> = {
    'investigation-template.md': `---
type: investigation
case_id: "{{case_id}}"
title: "{{title}}"
status: active
severity: {{severity}}
cvss: {{cvss}}
opened: {{date}}
operator: ${config.operatorName}
org: "{{org}}"
tags: []
targets: []
tools_used:
sessions:
evidence_count: 0
linked_cases:
---

# {{title}}

## Summary
**Severity:** {{severity}} (CVSS {{cvss}}) | **Opened:** {{date}} | **Organization:** {{org}}

## Targets
*Add targets*

## Timeline
| Time | Event |
|------|-------|
| {{date}} | Investigation opened |

## Evidence
*No evidence yet*

## Notes
`,
    'target-template.md': `---
type: target
domain: "{{domain}}"
ips: []
owner: ""
tech_stack: []
open_ports: {}
first_seen: {{date}}
last_scanned: {{date}}
investigations: []
tags: []
---

# {{domain}}

## Notes
`,
    'finding-template.md': `---
type: evidence
tool: {{tool}}
target: "{{target}}"
status: completed
---

# {{tool}} finding

## Output

`,
    'daily-log-template.md': `---
type: daily-log
date: {{date}}
operator: ${config.operatorName}
investigations_touched: []
tools_run: 0
findings_confirmed: 0
---

# {{date}}

## Summary

## Investigations Touched
`,
  };

  for (const [name, content] of Object.entries(templates)) {
    await fsp.writeFile(path.join(tplDir, name), content);
  }
}

async function writePlaybooks(vp: string): Promise<void> {
  const pbDir = path.join(vp, 'Playbooks');
  await fsp.mkdir(pbDir, { recursive: true });

  const playbooks: Array<{ name: string; content: string }> = [
    {
      name: 'web-app-pentest',
      content: `---
type: playbook
name: Web Application Pentest
category: offensive
estimated_duration: 4-8 hours
tools:
  - nmap
  - nuclei
  - nikto
  - ffuf
  - burpsuite
  - sqlmap
---

# Web Application Pentest Playbook

## Phase 1: Recon
1. \`carina recon scan <target> --scan-type service\`
2. \`carina fuzz dirs <target>\`
3. \`carina fuzz params <target>\`

## Phase 2: Vuln Scan
4. \`carina vuln scan <target> --templates all\`
5. \`carina vuln web <target>\`

## Phase 3: Exploit Validation
6. For each CVE found: \`carina exploit validate <cve>\`
7. Document findings in case notes

## Phase 4: Report
8. \`carina report generate <case-id>\`
9. Review and deliver
`,
    },
    {
      name: 'incident-response',
      content: `---
type: playbook
name: Incident Response
category: defensive
estimated_duration: 2-24 hours
tools:
  - volatility3
  - yara
  - wireshark
  - sleuthkit
---

# Incident Response Playbook

## Phase 1: Containment
1. Isolate affected systems
2. Capture memory: \`carina forensic image <device>\`

## Phase 2: Analysis
3. \`carina forensic memory <dump>\`
4. \`carina forensic yara <target>\`
5. \`carina analyze pcap <file>\`

## Phase 3: Timeline
6. \`carina forensic timeline <image>\`

## Phase 4: Report
7. \`carina report stix <case-id>\`
`,
    },
  ];

  for (const pb of playbooks) {
    await fsp.writeFile(path.join(pbDir, `${pb.name}.md`), pb.content);
  }
}

async function appendToInvestigation(casePath: string, tool: string): Promise<void> {
  const indexPath = path.join(casePath, 'index.md');
  let content = await fsp.readFile(indexPath, 'utf-8');

  if (/^tools_used:\s*$/m.test(content) && !content.includes(`  - ${tool}`)) {
    content = content.replace(/^tools_used:\s*$/m, `tools_used:\n  - ${tool}`);
  } else if (!content.includes(`  - ${tool}`)) {
    content = content.replace(/^tools_used:\n/m, `tools_used:\n  - ${tool}\n`);
  }

  const countMatch = content.match(/evidence_count: (\d+)/);
  const newCount = (countMatch ? Number.parseInt(countMatch[1]!, 10) : 0) + 1;
  content = content.replace(/evidence_count: \d+/, `evidence_count: ${newCount}`);
  await fsp.writeFile(indexPath, content);
  await appendTimeline(casePath, `${new Date().toISOString()} | Evidence added (${tool})`);
}

async function appendTimeline(casePath: string, row: string): Promise<void> {
  const timelinePath = path.join(casePath, 'timeline.md');
  try {
    const content = await fsp.readFile(timelinePath, 'utf-8');
    await fsp.writeFile(timelinePath, `${content}| ${row} |\n`);
  } catch {
    // timeline optional
  }
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1]!.split('\n');
  const result: Record<string, unknown> = {};
  let currentKey = '';
  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      (result[currentKey] as string[]).push(line.slice(4).replace(/"/g, ''));
    } else if (line.includes(':')) {
      const [key, ...rest] = line.split(':');
      currentKey = key!.trim();
      const val = rest.join(':').trim().replace(/"/g, '');
      if (val && val !== '[]' && val !== '{}') result[currentKey] = val;
    }
  }
  return result;
}

async function walkForCase(dir: string, caseId: string): Promise<string | null> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const full = path.join(dir, ent.name);
    if (ent.name === caseId) {
      try {
        await fsp.access(path.join(full, 'index.md'));
        return full;
      } catch {
        // keep searching
      }
    }
    const nested = await walkForCase(full, caseId);
    if (nested) return nested;
  }

  return null;
}

async function searchMarkdownFiles(
  dir: string,
  needle: string,
  results: Array<{ path: string; title: string; type: string }>,
): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await searchMarkdownFiles(full, needle, results);
      continue;
    }
    if (!ent.name.endsWith('.md')) continue;
    const content = await fsp.readFile(full, 'utf-8');
    if (!content.toLowerCase().includes(needle)) continue;
    const parsed = parseFrontmatter(content);
    results.push({
      path: full,
      title: String(parsed.title ?? parsed.domain ?? ent.name),
      type: String(parsed.type ?? 'note'),
    });
  }
}

async function collectVaultStats(vaultPath: string): Promise<VaultStats> {
  const stats: VaultStats = {
    openInvestigations: 0,
    closedInvestigations: 0,
    targetsMonitored: 0,
    evidenceFiles: 0,
    totalCaseNotes: 0,
    vaultSizeBytes: 0,
  };

  try {
    const targetFiles = await fsp.readdir(path.join(vaultPath, 'Targets'));
    stats.targetsMonitored = targetFiles.filter((f) => f.endsWith('.md')).length;
  } catch {
    // vault may not exist yet
  }

  await walkStats(path.join(vaultPath, 'Investigations'), stats);
  stats.vaultSizeBytes = await dirSize(vaultPath);
  return stats;
}

async function walkStats(dir: string, stats: VaultStats): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (!ent.isDirectory()) continue;

    const indexPath = path.join(full, 'index.md');
    try {
      const content = await fsp.readFile(indexPath, 'utf-8');
      if (/^type: investigation/m.test(content)) {
        stats.totalCaseNotes += 1;
        if (/^status: active/m.test(content)) stats.openInvestigations += 1;
        if (/^status: closed/m.test(content)) stats.closedInvestigations += 1;
      }
    } catch {
      // not a case folder
    }

    if (ent.name === 'evidence') {
      const files = await fsp.readdir(full).catch(() => [] as string[]);
      stats.evidenceFiles += files.filter((f) => f.endsWith('.md')).length;
    }

    await walkStats(full, stats);
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      total += await dirSize(full);
    } else {
      const stat = await fsp.stat(full);
      total += stat.size;
    }
  }
  return total;
}
