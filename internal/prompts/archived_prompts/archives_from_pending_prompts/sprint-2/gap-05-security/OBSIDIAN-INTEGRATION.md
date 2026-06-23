# Carina Obsidian Integration; Investigation Knowledge Base

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-17 (revised 2026-06-19)
**Build Estimate:** 1 week (core shipped; bridge + forensics unification pending)
**Dependencies:** Scout Findings API (gap-05), Scout investigation store, optional link to `05-forensics-pipeline.md`
**Files (shipped):**
- `core.carinaai.uk/src/integrations/obsidian-vault.ts`
- `core.carinaai.uk/src/integrations/scout-obsidian-bridge.ts`
- `core.carinaai.uk/src/cli/groups/obsidian.ts`

---

## PURPOSE

Turn every Carina investigation into a permanent, structured, cross-linked Obsidian vault. Operators don't just run tools; they build an intelligence archive. Obsidian solves graph view, backlinks, search, templates, and sync. Carina just needs to output the right files.

---

## VAULT STRUCTURE

```
$OBSIDIAN_VAULT_PATH/               ← Configured in Carina .env
│
├── Investigations/                  ← Root for all cases
│   └── 2026/                        ← Year folders
│       └── 06-June/                 ← Month folders
│           └── CVE-2024-1234--nginx-rce/  ← Case folder (slug)
│               ├── index.md               ← Master case note
│               ├── timeline.md            ← Chronological event log
│               ├── evidence/              ← Tool outputs + captures
│               │   ├── recon-nmap.md
│               │   ├── vuln-nuclei.md
│               │   ├── exploit-metasploit.md
│               │   └── screenshots/
│               │       └── msf-session.png
│               ├── targets/               ← Per-target profiles
│               │   └── app.example.com.md
│               └── reports/
│                   └── final-report.md    ← Auto-generated
│
├── Targets/                         ← Persistent target profiles
│   ├── app.example.com.md           ← Cross-linked from investigations
│   └── 10.0.0.0-24.md
│
├── Tools/                           ← Tool reference (auto-generated once)
│   ├── nmap.md                      ← What it does, when to use
│   ├── nuclei.md
│   ├── metasploit.md
│   └── ... (72 tools)
│
├── Templates/                       ← Note templates
│   ├── investigation-template.md
│   ├── target-template.md
│   ├── finding-template.md
│   └── daily-log-template.md
│
├── Playbooks/                       ← Operator playbooks
│   ├── web-app-pentest.md
│   ├── internal-network-audit.md
│   ├── incident-response.md
│   └── phishing-investigation.md
│
└── Dashboard.md                     ← Vault home: recent cases, stats, quick links
```

---

## FRONTMATTER SCHEMAS

### Investigation Note (`index.md`)

```yaml
---
type: investigation
case_id: "CVE-2024-1234--nginx-rce"
title: "CVE-2024-1234; nginx RCE on app.example.com"
status: active              # active | closed | false-positive
severity: critical           # critical | high | medium | low | info
cvss: 9.8
opened: 2026-06-17T14:30:00Z
closed:
operator: laud
org: "Example Corp"
scout_finding_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
tags:
  - nginx
  - rce
  - cve-2024
  - app.example.com
targets:
  - "[[../Targets/app.example.com]]"
tools_used:
  - nmap
  - nuclei
  - metasploit
sessions:
  - meterpreter-1
evidence_count: 4
linked_cases:
  - "[[CVE-2024-4321--ssh-brute-force]]"
---
```

### Target Profile

```yaml
---
type: target
domain: "app.example.com"
ips:
  - 93.184.216.34
owner: "Example Corp"
tech_stack:
  - nginx/1.24.0
  - php/8.1
  - mysql/8.0
open_ports:
  22: ssh
  80: http
  443: https
first_seen: 2026-01-15
last_scanned: 2026-06-17
investigations:
  - "[[../Investigations/2026/06-June/CVE-2024-1234--nginx-rce/index]]"
notes: "Production server, CDN fronted"
---
```

### Evidence Note (Tool Output)

```yaml
---
type: evidence
investigation: "[[../index]]"
tool: nmap
scan_type: service
scan_id: "scan_20260617_143000"
target: "app.example.com"
duration_seconds: 45.2
status: completed
artifacts:
  - "screenshots/nmap-scan.png"
---
```

### Daily Log

```yaml
---
type: daily-log
date: 2026-06-17
operator: laud
investigations_touched:
  - "[[../../06-June/CVE-2024-1234--nginx-rce/index]]"
tools_run: 12
findings_confirmed: 3
---
```

---

## TYPE SCRIPT MODULE

```typescript
// src/integrations/obsidian-vault.ts

import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

interface ObsidianConfig {
  vaultPath: string; // e.g., ~/Documents/Security Vault
  operatorName: string;
  autoGenerate: {
    investigations: boolean; // Auto-create case notes on investigation open
    evidence: boolean; // Auto-create evidence notes on tool completion
    targets: boolean; // Auto-create/update target profiles
    dailyLog: boolean; // Auto-append to daily log
  };
  templates: {
    investigation: string; // Path to template
    target: string;
    finding: string;
    dailyLog: string;
  };
}

function getConfig(): ObsidianConfig {
  return {
    vaultPath: process.env.OBSIDIAN_VAULT_PATH || '~/Documents/Obsidian Vault',
    operatorName: process.env.CARINA_OPERATOR || 'operator',
    autoGenerate: {
      investigations: true,
      evidence: true,
      targets: true,
      dailyLog: true,
    },
    templates: {
      investigation: 'Templates/investigation-template.md',
      target: 'Templates/target-template.md',
      finding: 'Templates/finding-template.md',
      dailyLog: 'Templates/daily-log-template.md',
    },
  };
}

// ============================================================
// VAULT BOOTSTRAP
// ============================================================

async function bootstrapVault(config: ObsidianConfig): Promise<void> {
  const vp = config.vaultPath;
  const dirs = [
    'Investigations',
    'Targets',
    'Tools',
    'Templates',
    'Playbooks',
    'Evidence',  // global evidence if not case-specific
  ];
  for (const dir of dirs) {
    await mkdir(join(vp, dir), { recursive: true });
  }
  // Generate Dashboard.md
  await writeDashboard(vp, config);
  // Generate tool reference notes
  await generateToolNotes(vp);
  // Generate templates
  await writeTemplates(vp, config);
  // Generate playbooks
  await writePlaybooks(vp);
}

// ============================================================
// INVESTIGATION NOTES
// ============================================================

interface InvestigationData {
  caseId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cvss: number;
  scoutFindingId?: string;
  tags: string[];
  targets: string[];
  org: string;
}

async function createInvestigation(
  config: ObsidianConfig,
  data: InvestigationData
): Promise<string> {
  const vp = config.vaultPath;
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = now.toLocaleString('en', { month: 'short' }); // 'June'
  const path = join(vp, 'Investigations', year, `${now.getMonth() + 1}-${month}`, data.caseId);

  await mkdir(path, { recursive: true });
  await mkdir(join(path, 'evidence', 'screenshots'), { recursive: true });
  await mkdir(join(path, 'targets'), { recursive: true });
  await mkdir(join(path, 'reports'), { recursive: true });

  // Write index.md
  const frontmatter = `---
type: investigation
case_id: "${data.caseId}"
title: "${data.title}"
status: active
severity: ${data.severity}
cvss: ${data.cvss}
opened: ${now.toISOString()}
operator: ${config.operatorName}
org: "${data.org}"
scout_finding_id: "${data.scoutFindingId || ''}"
tags:
${data.tags.map(t => `  - ${t}`).join('\n')}
targets:
${data.targets.map(t => `  - "[[../Targets/${t}]]"`).join('\n')}
tools_used: []
sessions: []
evidence_count: 0
linked_cases: []
---`;

  const body = `
# ${data.title}

## Summary
- **Severity:** ${data.severity.toUpperCase()} (CVSS ${data.cvss})
- **Opened:** ${now.toISOString()}
- **Organization:** ${data.org}
- **Scout Finding:** \`${data.scoutFindingId || 'N/A'}\`

## Targets
${data.targets.map(t => `- [[../Targets/${t}|${t}]]`).join('\n')}

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
  await writeFile(join(path, 'index.md'), frontmatter + '\n' + body);
  await writeFile(join(path, 'timeline.md'), `# Timeline; ${data.caseId}\n\n| Time | Event |\n|------|-------|\n| ${now.toISOString()} | Investigation opened |\n`);

  // Create/update target profiles
  for (const target of data.targets) {
    await upsertTarget(config, target, {
      tags: data.tags,
      org: data.org,
      investigations: [data.caseId],
    });
  }

  return path;
}

// ============================================================
// EVIDENCE NOTES
// ============================================================

interface EvidenceData {
  caseId: string;
  casePath: string;
  tool: string;
  scanType: string;
  scanId: string;
  target: string;
  output: string; // Parsed tool output (markdown)
  status: 'completed' | 'failed';
  durationSeconds: number;
  artifacts?: string[]; // Screenshot paths
}

async function addEvidence(
  config: ObsidianConfig,
  data: EvidenceData
): Promise<string> {
  const evidenceDir = join(data.casePath, 'evidence');
  const filename = `${data.tool}-${data.scanType}.md`;
  const path = join(evidenceDir, filename);

  const frontmatter = `---
type: evidence
investigation: "[[../index]]"
tool: ${data.tool}
scan_type: ${data.scanType}
scan_id: "${data.scanId}"
target: "${data.target}"
duration_seconds: ${data.durationSeconds}
status: ${data.status}
artifacts:
${(data.artifacts || []).map(a => `  - "${a}"`).join('\n')}
---`;

  const body = `
# ${data.tool}; ${data.scanType}

**Target:** [[../../Targets/${data.target}|${data.target}]]
**Duration:** ${data.durationSeconds}s
**Status:** ${data.status}

## Output

${data.output}
`;
  await writeFile(path, frontmatter + '\n' + body);

  // Update investigation index; add tool to tools_used
  await appendToInvestigation(data.casePath, data.tool);

  return path;
}

// ============================================================
// TARGET PROFILES
// ============================================================

interface TargetData {
  domain?: string;
  ips?: string[];
  owner?: string;
  techStack?: string[];
  openPorts?: Record<number, string>;
  tags?: string[];
  org?: string;
  investigations?: string[];
}

async function upsertTarget(
  config: ObsidianConfig,
  targetName: string,
  data: TargetData
): Promise<string> {
  const vp = config.vaultPath;
  const path = join(vp, 'Targets', `${targetName}.md`);
  const now = new Date().toISOString().slice(0, 10);

  // Check if target exists
  let existing: TargetData = {};
  try {
    const content = await readFile(path, 'utf-8');
    existing = parseFrontmatter(content);
  } catch {
    // New target
  }

  const merged = {
    ...existing,
    ...data,
    ips: [...new Set([...(existing.ips || []), ...(data.ips || [])])],
    techStack: [...new Set([...(existing.techStack || []), ...(data.techStack || [])])],
    openPorts: { ...(existing.openPorts || {}), ...(data.openPorts || {}) },
    investigations: [...new Set([...(existing.investigations || []), ...(data.investigations || [])])],
  };

  const invLinks = (merged.investigations || [])
    .map(id => `  - "[[../Investigations/*/${id}/index|${id}]]"`)
    .join('\n');

  const frontmatter = `---
type: target
domain: "${merged.domain || targetName}"
ips:
${(merged.ips || []).map(ip => `  - ${ip}`).join('\n')}
owner: "${merged.owner || merged.org || ''}"
tech_stack:
${(merged.techStack || []).map(t => `  - ${t}`).join('\n')}
open_ports:
${Object.entries(merged.openPorts || {}).map(([p, s]) => `  ${p}: ${s}`).join('\n')}
first_seen: ${(existing as any).first_seen || now}
last_scanned: ${now}
investigations:
${invLinks}
tags:
${(merged.tags || []).map(t => `  - ${t}`).join('\n')}
---`;

  const body = `
# ${targetName}

| Field | Value |
|-------|-------|
| Domain | ${merged.domain || '-'} |
| IPs | ${(merged.ips || []).join(', ') || '-'} |
| Owner | ${merged.owner || '-'} |
| Tech Stack | ${(merged.techStack || []).join(', ') || '-'} |

## Open Ports
${Object.entries(merged.openPorts || {}).map(([p, s]) => `- **${p}:** ${s}`).join('\n') || '*None discovered*'}

## Investigations
${(merged.investigations || []).map(id => `- [[${id}]]`).join('\n') || '*No investigations yet*'}
`;
  await writeFile(path, frontmatter + '\n' + body);
  return path;
}

// ============================================================
// DAILY LOG
// ============================================================

async function appendDailyLog(
  config: ObsidianConfig,
  entries: {
    investigations: string[];
    toolsRun: number;
    findingsConfirmed: number;
    notes?: string;
  }
): Promise<void> {
  const vp = config.vaultPath;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const month = now.toLocaleString('en', { month: 'short' });
  const year = now.getFullYear().toString();
  const logDir = join(vp, 'Daily', year, `${now.getMonth() + 1}-${month}`);
  const logPath = join(logDir, `${dateStr}.md`);
  await mkdir(logDir, { recursive: true });

  const invLinks = entries.investigations
    .map(id => `- [[../Investigations/*/${id}/index|${id}]]`)
    .join('\n');

  const frontmatter = `---
type: daily-log
date: ${dateStr}
operator: ${config.operatorName}
investigations_touched:
${entries.investigations.map(id => `  - "${id}"`).join('\n')}
tools_run: ${entries.toolsRun}
findings_confirmed: ${entries.findingsConfirmed}
---`;

  const body = `
# ${dateStr}

## Summary
- **Tools Run:** ${entries.toolsRun}
- **Findings Confirmed:** ${entries.findingsConfirmed}
${entries.notes ? `\n**Notes:** ${entries.notes}\n` : ''}

## Investigations Touched
${invLinks}
`;
  await writeFile(logPath, frontmatter + '\n' + body);
}

// ============================================================
// DASHBOARD
// ============================================================

async function writeDashboard(vp: string, config: ObsidianConfig): Promise<void> {
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
- Open Investigations: *query placeholder*
- Targets Monitored: *query placeholder*
- Tools Available: 72
- Evidence Files: *query placeholder*

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
  await writeFile(join(vp, 'Dashboard.md'), content);
}

// ============================================================
// TOOL REFERENCE NOTES (auto-generated once)
// ============================================================

async function generateToolNotes(vp: string): Promise<void> {
  const toolsDir = join(vp, 'Tools');
  const tools: Array<{ name: string; category: string; risk: string; scout: boolean }> = [
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

  for (const tool of tools) {
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
carina ${tool.category.toLowerCase()} <action> <target>
\`\`\`

## When to Use
*See full tool spec in cyber-tools/${tool.name}.md*

## Related Tools
*Cross-links auto-generated from tool category*
`;
    await writeFile(join(toolsDir, `${tool.name}.md`), content);
  }
}

// ============================================================
// TEMPLATES
// ============================================================

async function writeTemplates(vp: string, config: ObsidianConfig): Promise<void> {
  const tplDir = join(vp, 'Templates');
  await mkdir(tplDir, { recursive: true });

  const investigationTemplate = `---
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
tools_used: []
sessions: []
evidence_count: 0
linked_cases: []
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
`;
  await writeFile(join(tplDir, 'investigation-template.md'), investigationTemplate);
}

// ============================================================
// PLAYBOOKS
// ============================================================

async function writePlaybooks(vp: string): Promise<void> {
  const pbDir = join(vp, 'Playbooks');
  await mkdir(pbDir, { recursive: true });

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
    await writeFile(join(pbDir, `${pb.name}.md`), pb.content);
  }
}

// ============================================================
// HELPERS
// ============================================================

async function appendToInvestigation(casePath: string, tool: string): Promise<void> {
  const indexPath = join(casePath, 'index.md');
  const content = await readFile(indexPath, 'utf-8');
  // Update tools_used in frontmatter
  if (content.includes('tools_used:')) {
    const updated = content.replace(
      /tools_used: \[(.*?)\]/s,
      (_, existing) => {
        const tools = existing ? existing.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        if (!tools.includes(tool)) tools.push(tool);
        return `tools_used: [${tools.join(', ')}]`;
      }
    );
    // Also append to evidence_count
    const countMatch = content.match(/evidence_count: (\d+)/);
    const newCount = (countMatch ? parseInt(countMatch[1]) : 0) + 1;
    const final = updated.replace(/evidence_count: \d+/, `evidence_count: ${newCount}`);
    await writeFile(indexPath, final);
  }
}

function parseFrontmatter(content: string): any {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1].split('\n');
  const result: any = {};
  let currentKey = '';
  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(line.slice(4).replace(/"/g, ''));
    } else if (line.includes(':')) {
      const [key, ...rest] = line.split(':');
      currentKey = key.trim();
      const val = rest.join(':').trim().replace(/"/g, '');
      if (val) result[currentKey] = val;
    }
  }
  return result;
}

// ============================================================
// CARINA CLI COMMANDS
// ============================================================

/*
carina obsidian init              → Bootstrap vault structure
carina obsidian dashboard         → Regenerate Dashboard.md
carina obsidian case new <title>  → Create investigation
carina obsidian case close <id>   → Mark investigation closed
carina obsidian evidence add <id> → Add evidence note to case
carina obsidian target add <name> → Create/update target profile
carina obsidian log today         → Open today's daily log
carina obsidian search <query>    → Search vault for investigations/targets
carina obsidian vault stats       → Show investigation counts, target counts
*/

// ============================================================
// INTEGRATION HOOKS (called from investigation pipeline)
// ============================================================

export async function onInvestigationOpened(data: InvestigationData): Promise<string> {
  const config = getConfig();
  if (!config.autoGenerate.investigations) return '';
  // Bootstrap if first time
  await bootstrapIfNeeded(config);
  const path = await createInvestigation(config, data);
  if (config.autoGenerate.dailyLog) {
    await appendDailyLog(config, { investigations: [data.caseId], toolsRun: 0, findingsConfirmed: 0 });
  }
  return path;
}

export async function onToolCompleted(data: EvidenceData): Promise<string> {
  const config = getConfig();
  if (!config.autoGenerate.evidence) return '';
  return addEvidence(config, data);
}

export async function onTargetDiscovered(target: string, data: TargetData): Promise<string> {
  const config = getConfig();
  if (!config.autoGenerate.targets) return '';
  return upsertTarget(config, target, data);
}

async function bootstrapIfNeeded(config: ObsidianConfig): Promise<void> {
  // Check if vault is bootstrapped
  try {
    await readFile(join(config.vaultPath, 'Dashboard.md'), 'utf-8');
  } catch {
    await bootstrapVault(config);
  }
}
```

---

## CARINA CLI COMMANDS

```bash
# Initialize vault (first time)
carina obsidian init
  → Creates folder structure, Dashboard.md, Templates, Playbooks, Tool notes
  → ~100 files, takes <2 seconds

# Create new investigation
carina obsidian case new "CVE-2024-1234; nginx RCE on app.example.com" \
  --severity critical --cvss 9.8 --org "Example Corp" \
  --targets app.example.com --tags nginx,rce,cve-2024
  → Creates case folder, index.md, timeline.md, updates target profiles

# Add evidence to investigation
carina obsidian evidence add <case-id> \
  --tool nmap --scan-type service --output /tmp/nmap-output.md
  → Creates evidence note, links from investigation index

# Close investigation
carina obsidian case close <case-id>
  → Updates frontmatter status to "closed", appends close date

# Daily log
carina obsidian log today
  → Opens or creates today's daily log note

# Stats
carina obsidian vault stats
  → Open investigations: 3
  → Targets monitored: 12
  → Evidence files: 47
  → Total case notes: 28
  → Vault size: 14MB

# Search
carina obsidian search "nginx rce"
  → Returns matching investigation and target notes

# Regenerate dashboard
carina obsidian dashboard
  → Refreshes Dashboard.md with latest counts
```

---

## ENVIRONMENT CONFIGURATION

```
# ~/.carina/.env

OBSIDIAN_VAULT_PATH=~/Documents/Security Vault
CARINA_OPERATOR=laud
OBSIDIAN_INTEGRATION=true          # set false to disable bridge entirely
OBSIDIAN_AUTO_INVESTIGATIONS=true
OBSIDIAN_AUTO_EVIDENCE=true
OBSIDIAN_AUTO_TARGETS=true
OBSIDIAN_AUTO_DAILY_LOG=true
```

---

## INTEGRATION POINTS (revised 2026-06-19)

Obsidian is the **operator-facing knowledge layer**. It is not the forensic system of record. See `ARCHITECTURE REVIEW` below.

```
carina scout investigate <finding_id> [--session <id>]
  │
  ├── saveInvestigation()                    ← ~/.carina/data/scout-investigations/
  ├── openScoutInvestigationInObsidian()     ← scout-obsidian-bridge.ts
  │     ├── onInvestigationOpened()          ← Obsidian case folder + index.md
  │     └── setActiveInvestigationContext()  ← active case pointer for tool hooks
  │
  ├── executeToolCall() (agent or cron)      ← tool-runner.ts
  │     └── notifyScoutObsidianToolCompleted()
  │           ├── onToolCompleted()          ← evidence/*.md
  │           └── onTargetDiscovered()       ← Targets/*.md (ports, tech stack)
  │
  └── (future) forensicsEngine.exportEvidence(format: 'markdown')
        └── writes reports/final-report.md with custody summary link
```

**Not yet wired (blocked on cyber-tools CLI from `13-cyber-security-tools.md`):**
- `carina recon scan`, `carina exploit validate`, `carina report generate` as named commands
- Until those exist, evidence flows through `shell-exec` and generic Carina tools via the bridge

**Not Obsidian's job (lives in `src/security/forensics/`):**
- SHA-256 artifact hashing
- Append-only chain of custody (`forensics/custody.jsonl`)
- Immutable snapshot capture (`forensics/snapshots/`)
- Automated IR playbook execution (prompt injection, exfiltration, kill switch)

---

## PITFALLS

1. **Vault path must be absolute**; `~` must be resolved; `$HOME` must be expanded
2. **Concurrent writes**; if two investigations write to the same target profile, last write wins. Use file locking or queue writes.
3. **Vault on network drive**; Obsidian sync (iCloud, Syncthing) can cause conflicts. Use Obsidian Sync or git for multi-machine.
4. **Large evidence files**; don't embed screenshots in markdown; store as separate files and reference with `![[screenshot.png]]`
5. **Frontmatter parsing**; simple regex, not full YAML. Upgrade to `js-yaml` if complexity grows.
6. **Template variables**; `{{case_id}}` etc. are just placeholders; actual values injected by `createInvestigation()`

---

## VERIFICATION

```bash
# Test bootstrap
carina obsidian init
ls -la "$OBSIDIAN_VAULT_PATH"
# Should show: Dashboard.md, Investigations/, Targets/, Tools/, Templates/, Playbooks/

# Test case creation
carina obsidian case new "Test Case" --severity high --cvss 7.5 --org "Test" --targets example.com
ls "$OBSIDIAN_VAULT_PATH/Investigations/$(date +%Y)/$(date +%-m)-$(date +%b)/Test-Case/"
# Should show: index.md, timeline.md, evidence/, targets/, reports/

# Test end-to-end with real data
carina scout pull <org_id>
carina scout investigate <finding_id>  # triggers onInvestigationOpened
carina recon scan <target>             # triggers onToolCompleted + onTargetDiscovered
carina obsidian vault stats            # should show updated counts
```

---

## WHAT THIS GIVES YOU

| Without Obsidian | With Obsidian |
|-----------------|---------------|
| Tool output lost after terminal session | Every scan saved as permanent note |
| Manual case notes (if any) | Auto-generated structured case files |
| No cross-references between targets/CVEs | Graph view showing all relationships |
| Investigation knowledge dies with operator | Vault becomes institutional knowledge |
| Reports exported as one-off PDFs | Vault IS the living report, always current |
| No search across past investigations | Full-text search across all cases |
| No playbook library | Playbooks live alongside tools and cases |

---

## BUILD ESTIMATE

- **Lines of code:** ~500 (single module)
- **Files to create:** 1 TypeScript file + ~100 auto-generated markdown notes
- **Integration points:** 3 hooks into existing pipeline
- **CLI commands:** 8 new commands
- **Testing:** bootstrap test, case creation test, evidence append test, concurrent write test
- **Time:** 3 days development + 1 day testing + 1 day docs = **1 week**

---

## ARCHITECTURE REVIEW (2026-06-19)

Review against shipped code and `05-forensics-pipeline.md`. Use this section to avoid duplicate systems and marketing overclaims.

### Three parallel case tracks (do not merge storage)

| Track | Purpose | System of record | Human-readable export |
|-------|---------|------------------|------------------------|
| **Scout investigation** | External findings, pentest validation | `~/.carina/data/scout-investigations/*.json` | Obsidian vault case folder |
| **Forensic incident** | Internal IR (injection, exfil, kill switch) | `~/.carina/data/forensics/` (JSONL + snapshots) | `forensics/exports/{id}/` (JSON/CSV/MD) |
| **Obsidian vault** | Operator knowledge graph, board prep | Markdown on disk (mutable) | Obsidian app / git sync |

Obsidian is a **projection layer** for Scout (and eventually Forensics). It must never replace custody logs or hashed artifacts.

### Conflicts with forensics pipeline

| Area | Obsidian spec | Forensics pipeline (`src/security/forensics/`) | Resolution |
|------|---------------|-----------------------------------------------|------------|
| Chain of custody | Not specified (but implied in product copy) | SHA-256 hash chain in `custody.jsonl` | Custody stays in forensics only. Obsidian notes may **link** to custody record IDs, not replicate them. |
| Timeline | `timeline.md` markdown table | `timeline/{incidentId}.json` structured events | Scout cases: keep markdown timeline. Forensic incidents: generate Obsidian appendix from JSON export on `report` step. |
| Playbooks | `Playbooks/web-app-pentest.md` (offensive) | `FORENSIC_PLAYBOOKS` (defensive, automated) | Rename vault folder to `Playbooks/offensive/` or prefix frontmatter `category: offensive` to avoid confusion with IR playbooks. |
| Evidence | Mutable markdown in vault | Hashed artifacts under `forensics/artifacts/` | Obsidian stores **summaries + links**. Binary artifacts and hashes live in forensics store only. |
| Case status | `active \| closed \| false-positive` | `active \| contained \| investigating \| resolved` | Add mapping table in bridge; do not use the same enum in both systems without translation. |
| Reports | `reports/final-report.md` | `formatForensicReportMarkdown()` + export dir | Single writer: forensics export generates markdown; Obsidian bridge copies into case `reports/` with frontmatter link to `forensic_incident_id`. |

### Marketing correction required

`instructions/product/WHAT_IS_CARINA.md` line 63 claims Obsidian vault notes include **chain of custody**. That is inaccurate today. Chain of custody is forensics-only. Update product copy to: "Obsidian vault for investigation notes; forensic chain of custody in Carina forensics store."

### Spec gaps (original doc vs reality)

1. **Cyber CLI commands** referenced in playbooks (`carina recon scan`, etc.) do not exist yet; see `13-cyber-security-tools.md`. Bridge handles `shell-exec` + generic tools instead.
2. **72 tool notes** in vault bootstrap; shipped catalog has 20 tools. Either generate from `gap-05-security/cyber-tools/` corpus or document "bootstrap subset; expand on demand."
3. **Per-case `targets/` subfolder** in vault tree is not populated; targets live only at vault root `Targets/`. Drop per-case duplicates or symlink in a later pass.
4. **Playbooks:** spec lists 4 (`web-app-pentest`, `internal-network-audit`, `incident-response`, `phishing-investigation`); shipped bootstrap writes 2. IR playbook content overlaps forensics playbooks; keep offensive playbooks in Obsidian, defensive IR in forensics engine.
5. **Concurrent investigations:** active context is a single file (`scout-investigation-active.json`). Spec pitfall #2 is only partially fixed (target profile locking exists; active case is still last-write-wins). Need `sessionId`-scoped or stack-based active context.
6. **No forensics CLI** yet; `forensicsEngine` is library-only. Obsidian cannot receive forensic exports until `carina forensics export --obsidian` exists.
7. **`obsidian-notes` productivity skill** may write to the same vault without bridge awareness. Document vault path convention or route skill through `obsidian-vault.ts` helpers.
8. **Spec code sample** shows inline `tools_used: [...]` YAML; implementation uses list form. Treat embedded TypeScript in this doc as illustrative; source of truth is `obsidian-vault.ts`.

### Shipped vs pending

| Item | Status |
|------|--------|
| `obsidian-vault.ts` bootstrap, cases, evidence, targets, daily log, search, stats | Done |
| `carina obsidian` CLI group (8 command families) | Done |
| Scout investigate → Obsidian case | Done via `scout-obsidian-bridge.ts` |
| Tool-runner → evidence + target hooks | Done (active investigation required) |
| Target write locking | Done |
| Forensics → Obsidian report sync | Pending |
| Unified case ID linking (`scout_finding_id`, `forensic_incident_id` in frontmatter) | Partial (scout only) |
| Multi-active investigation / session stack | Pending |
| Full 72-tool vault notes from cyber-tools corpus | Pending |
| Concurrent write test | Pending |

### Proposed unified case model (next iteration)

Add optional cross-links without merging stores:

```yaml
# Obsidian index.md (additions)
scout_investigation_id: "<uuid>"
forensic_incident_id: "<uuid>"      # when IR playbook also opened
custody_export_path: "[[../../forensics/exports/<id>/report.md]]"
```

Bridge function (future): `linkForensicIncidentToObsidianCase(forensicIncidentId, caseId)` called from `forensics/export.ts` after markdown export.

### Boundary rules (hard constraints)

1. **Never** write custody hashes only to Obsidian; always append to `forensics/custody.jsonl` first.
2. **Never** treat Obsidian file mtime as evidence integrity proof; use forensic artifact hashes for audits.
3. **Scout investigate** opens offensive cases; **forensicsEngine.openFromSecurityEvent** opens defensive cases; either may create an Obsidian note, but only one system owns each ID namespace.
4. Obsidian vault path must stay outside `~/.carina/data/` to avoid sync tools corrupting Carina runtime state.

### Revised build estimate

- **Core Obsidian + Scout bridge:** done (~900 LOC across 3 modules + tests)
- **Forensics export → Obsidian:** 2-3 days
- **Session-scoped active context + multi-case:** 1-2 days
- **72-tool note generation from cyber-tools specs:** 1-2 days
- **Total remaining:** ~1 week to reach spec-complete alignment with forensics