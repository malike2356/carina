# Migration & Competitive Takeover; Full Implementation Plan

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-17
**Status:** READY; All prompts, all specs, all roadmaps
**Build Estimate:** 6 weeks parallel with existing gap work
**Depends On:** gap-05 Scout core (findings API + dashboard), gap-03 skill hub

---

## EXECUTIVE SUMMARY

Carina won't win by being a better agent than Hermes, OpenClaw, or Odysseus. It wins by being a different category; the only agent that is also a security platform. This document contains all implementation prompts, full specs, and three roadmaps you need to capture users from competing ecosystems.

---

# PART 1: IMPORT TOOLS; ZERO SWITCHING COST

## 1.1 Prompt: `carina import` CLI

### GOAL
Build a unified import CLI that reads Hermes, OpenClaw, and Odysseus installations on the user's machine and migrates their skills, config, history, and memory into Carina; with one command.

### SPECIFICATION

```
carina import detect
  → Scans $HOME for Hermes (~/.hermes/), OpenClaw (~/.openclaw/), Odysseus (~/.odysseus/)
  → Reports: "Found Hermes (174MB, 51 skills, 847 sessions), OpenClaw (297MB, 20099 files)"
  → Prompts: "Import Hermes?" [Y/n]

carina import from-hermes [--dry-run] [--what skills,config,history,memory,cron]
  → Reads ~/.hermes/skills/*/SKILL.md → writes to Carina skills/ with name mapping
  → Reads ~/.hermes/config.yaml → maps providers, models, tools to Carina config
  → Reads ~/.hermes/sessions/ → imports as Carina memory entries
  → Reads ~/.hermes/.env → merges environment variables
  → Reads ~/.hermes/cron/ → converts to Carina cronjob format
  → Generates import report: "51 skills imported. 3 failed (format mismatch). 847 sessions archived."

carina import from-openclaw [--dry-run] [--what agents,skills,config,history]
  → Reads ~/.openclaw/agents/ → maps to Carina agent profiles
  → Reads OpenClaw skills → converts to Carina skill format
  → Reads OpenClaw config → maps to Carina provider/model config
  → Reads chat history → imports as sessions

carina import from-odysseus [--dry-run]
  → Reads prompts/ → converts to Carina instructions
  → Reads config → maps to Carina config
  → Reads state → imports as memory
```

### IMPLEMENTATION DETAILS

```typescript
// src/cli/commands/import.ts

interface ImportSource {
  name: 'hermes' | 'openclaw' | 'odysseus';
  homePath: string; // Default install path
  detectFiles: string[]; // Files that confirm installation
  parsers: {
    skills: (src: string) => CarinaSkill[];
    config: (src: string) => CarinaConfig;
    history: (src: string) => MemoryEntry[];
    memory: (src: string) => MemoryEntry[];
    cron: (src: string) => CronJobDef[];
  };
}

const IMPORT_SOURCES: ImportSource[] = [
  {
    name: 'hermes',
    homePath: '~/.hermes',
    detectFiles: ['config.yaml', 'skills/', 'sessions/'],
    parsers: {
      skills: parseHermesSkills,
      config: parseHermesConfig,
      history: parseHermesSessions,
      memory: parseHermesMemory,
      cron: parseHermesCron,
    },
  },
  {
    name: 'openclaw',
    homePath: '~/.openclaw',
    detectFiles: ['.openclawrc', 'agents/'],
    parsers: {
      skills: parseOpenClawSkills,
      config: parseOpenClawConfig,
      history: parseOpenClawHistory,
      memory: parseOpenClawMemory,
      cron: () => [],
    },
  },
  {
    name: 'odysseus',
    homePath: '~/.odysseus',
    detectFiles: ['prompts/', '.odysseusrc'],
    parsers: {
      skills: parseOdysseusPrompts,
      config: parseOdysseusConfig,
      history: () => [],
      memory: () => [],
      cron: () => [],
    },
  },
];
```

### Hermes Skills Parser

```typescript
function parseHermesSkills(basePath: string): CarinaSkill[] {
  // Hermes skills: ~/.hermes/skills/<name>/SKILL.md
  // Format: YAML frontmatter + markdown body
  // Carina skills: same format, slightly different frontmatter keys

  const skillsDir = join(basePath, 'skills');
  const skillFiles = globSync(skillsDir, '**/SKILL.md');
  const imported: CarinaSkill[] = [];

  for (const file of skillFiles) {
    const content = readFileSync(file, 'utf-8');
    const { data: fm, content: body } = parseFrontmatter(content);

    const skill: CarinaSkill = {
      name: fm.name || path.basename(path.dirname(file)),
      description: fm.description || '',
      category: fm.category || 'imported',
      platforms: fm.platforms || ['linux', 'macos', 'windows'],
      content: body,
      source: 'hermes',
      importedAt: new Date().toISOString(),
    };
    imported.push(skill);
  }
  return imported;
}
```

### Hermes Config Mapper

```typescript
function parseHermesConfig(basePath: string): CarinaConfig {
  const hermesConfig = yaml.parse(readFileSync(join(basePath, 'config.yaml'), 'utf-8'));

  // Map Hermes config keys → Carina config keys
  return {
    model: hermesConfig.model,
    provider: hermesConfig.provider,
    // Provider credentials
    providers: mapHermesProviders(hermesConfig),
    // Tool configuration
    tools: mapHermesTools(hermesConfig),
    // Platform connections
    channels: mapHermesChannels(hermesConfig),
    // Cron jobs
    cron: mapHermesCron(hermesConfig),
  };
}

function mapHermesProviders(hc: any): CarinaProviderConfig {
  const providers: CarinaProviderConfig = {};
  // Hermes stores API keys in .env prefixed with provider name
  // e.g., ANTHROPIC_API_KEY=..., OPENAI_API_KEY=...
  // Carina maps them to provider config blocks
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('_API_KEY') && value) {
      const providerName = key.replace('_API_KEY', '').toLowerCase();
      providers[providerName] = { apiKey: value as string };
    }
  }
  return providers;
}
```

### Hermes Session Importer

```typescript
function parseHermesSessions(basePath: string): MemoryEntry[] {
  // Hermes stores sessions in SQLite: ~/.hermes/sessions/
  // We read the session DB and extract user-agent exchanges
  const dbPath = join(basePath, 'sessions', 'sessions.db');
  const db = new Database(dbPath);

  const rows = db.prepare(`
    SELECT session_id, role, content, created_at
    FROM messages
    WHERE role IN ('user', 'assistant')
    ORDER BY created_at DESC
    LIMIT 5000
  `).all();

  const entries: MemoryEntry[] = [];
  let currentSession = '';
  let currentContent = '';

  for (const row of rows) {
    if (row.session_id !== currentSession) {
      if (currentContent) {
        entries.push({
          target: 'memory',
          content: `[Hermes session ${currentSession}]\n${currentContent.slice(0, 2000)}`,
          source: 'hermes-import',
          importedAt: new Date().toISOString(),
        });
      }
      currentSession = row.session_id;
      currentContent = '';
    }
    currentContent += `[${row.role}]: ${row.content}\n`;
  }
  return entries;
}
```

### OpenClaw Agent Importer

```typescript
function parseOpenClawAgents(basePath: string): CarinaAgentProfile[] {
  // OpenClaw stores agent definitions in ~/.openclaw/agents/
  // Each agent has a JSON/YAML config + possibly skill files
  const agentsDir = join(basePath, 'agents');
  const agentFiles = globSync(agentsDir, '*.{json,yaml,yml}');
  const profiles: CarinaAgentProfile[] = [];

  for (const file of agentFiles) {
    const config = yaml.parse(readFileSync(file, 'utf-8'));
    profiles.push({
      name: config.name || path.basename(file, path.extname(file)),
      model: config.model,
      provider: config.provider,
      instructions: config.instructions || config.system_prompt,
      tools: config.tools || [],
      skills: config.skills || [],
    });
  }
  return profiles;
}
```

### OpenClaw Skills Parser

```typescript
function parseOpenClawSkills(basePath: string): CarinaSkill[] {
  // OpenClaw skills differ from Hermes:
  // - May be in .ts/.js files (code skills) or .md files (prompt skills)
  // - Need transformation to Carina SKILL.md format

  const skillsDir = join(basePath, 'skills');
  const files = [
    ...globSync(skillsDir, '**/*.md'),
    ...globSync(skillsDir, '**/*.ts'),
    ...globSync(skillsDir, '**/*.js'),
  ];
  const imported: CarinaSkill[] = [];

  for (const file of files) {
    if (file.endsWith('.md')) {
      imported.push(convertMarkdownSkill(file));
    } else {
      imported.push(convertCodeSkillToPrompt(file));
    }
  }
  return imported;
}

function convertCodeSkillToPrompt(filePath: string): CarinaSkill {
  // OpenClaw code skills are TypeScript modules
  // We wrap them as Carina prompt skills that tell Carina
  // to execute the .ts file as a script
  const name = path.basename(filePath, path.extname(filePath));
  const code = readFileSync(filePath, 'utf-8');

  return {
    name,
    description: `Imported OpenClaw skill: ${name}`,
    category: 'imported-openclaw',
    content: `# Imported from OpenClaw: ${name}\n\nExecute this script:\n\`\`\`typescript\n${code}\n\`\`\``,
    source: 'openclaw',
    importedAt: new Date().toISOString(),
  };
}
```

### Odysseus Prompt Importer

```typescript
function parseOdysseusPrompts(basePath: string): CarinaSkill[] {
  // Odysseus prompts are plain markdown or structured prompt files
  const promptsDir = join(basePath, 'prompts');
  const files = globSync(promptsDir, '*.{md,txt,prompt}');
  const imported: CarinaSkill[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const name = path.basename(file, path.extname(file));
    imported.push({
      name: `odysseus-${name}`,
      description: `Imported Odysseus prompt: ${name}`,
      category: 'imported-odysseus',
      content,
      source: 'odysseus',
      importedAt: new Date().toISOString(),
    });
  }
  return imported;
}
```

### Import Report

```typescript
interface ImportReport {
  source: string;
  timestamp: string;
  dryRun: boolean;
  results: {
    skills: { total: number; imported: number; failed: number; failures: string[] };
    config: { imported: boolean; warnings: string[] };
    history: { sessions: number; messages: number };
    memory: { entries: number };
    cron: { jobs: number };
    agents: { total: number; imported: number };
  };
}
```

### CLI Integration

```
carina import detect
   Hermes    found at ~/.hermes    (174MB, 51 skills, 847 sessions)
   OpenClaw  found at ~/.openclaw  (297MB, 20099 files, 3 agents)
   Odysseus  not found

carina import from-hermes --dry-run
  DRY RUN; nothing will be written
  51 skills found → 47 compatible, 4 need manual review
  847 sessions → will be imported as memory entries
  12 cron jobs → 11 compatible, 1 needs migration

carina import from-hermes
  Importing... ━━━━━━━━━━━━━━━ 100%
   47 skills imported (4 skipped; see import-report.md)
   847 sessions archived as memory
   11 cron jobs migrated
   Config providers mapped
   .env merged
  Report saved: ~/.hermes/imports/hermes-2026-06-17-report.md

carina import from-openclaw
  Importing... ━━━━━━━━━━━━━━━ 100%
   3 agents imported as Carina profiles
   12 skills imported
   Config mapped (provider keys preserved)
   4200 messages imported as sessions
  Report saved: ~/.hermes/imports/openclaw-2026-06-17-report.md
```

---

## 1.2 Roadmap: Import Tools

**Build Time:** 2 weeks
**Team:** 1 developer (backend + CLI)
**Dependencies:** None (reads external files, doesn't need Carina features)

### Week 1
```
Day 1-2: Data model + detect command
   ImportSource interface
   File detection (check for ~/.hermes, ~/.openclaw, ~/.odysseus)
   carina import detect command

Day 3-4: Hermes parser
   parseHermesSkills(); convert SKILL.md to Carina format
   parseHermesConfig(); map config.yaml keys
   parseHermesSessions(); SQLite session reader
   parseHermesMemory(); memory entries
   parseHermesCron(); cron job conversion

Day 5: OpenClaw parser
   parseOpenClawAgents(); agent definition importer
   parseOpenClawSkills(); .md + .ts/.js skill converter
   parseOpenClawConfig(); config mapper
   parseOpenClawHistory(); chat history importer
```

### Week 2
```
Day 1: Odysseus parser
   parseOdysseusPrompts(); prompt importer
   parseOdysseusConfig(); config mapper

Day 2-3: Import report + dry run
   ImportReport type
   --dry-run flag
   Report generator (markdown)

Day 4: Testing
   Test with real Hermes install (from agent-study/ clone)
   Test with real OpenClaw install (from agent-study/ clone)
   Test edge cases: empty skills/, missing config, corrupt sessions

Day 5: Polish
   Progress bars
   Error recovery (partial import)
   Documentation
```

### Deliverables
- `src/cli/commands/import.ts`; all import logic
- `src/import/parsers/hermes.ts`; Hermes parsers
- `src/import/parsers/openclaw.ts`; OpenClaw parsers
- `src/import/parsers/odysseus.ts`; Odysseus parsers
- `src/import/types.ts`; shared types
- Import report template

---

# PART 2: FREE SCOUT TIER; TROJAN HORSE

## 2.1 Prompt: Free Scout Landing Page + API

### GOAL
Build a zero-friction entry point: paste a domain, get findings in 2 minutes. No signup. No payment. No email. Just results. Every free scan ends with one call to action: "Carina can exploit these. Import your Hermes setup now."

### SPECIFICATION

```
https://scout.carinaai.uk/free

┌─────────────────────────────────────────────┐
│                                             │
│   What's on your attack surface?            │
│                                             │
│   ┌─────────────────────────────┐ [SCAN]    │
│   │ example.com                 │           │
│   └─────────────────────────────┘           │
│                                             │
│   Free. No signup. Results in ~2 minutes.   │
│                                             │
└─────────────────────────────────────────────┘
```

### Scan Flow

```
1. User enters domain → clicks SCAN
2. Backend validates: is it a routable domain? Rate limit: 1 scan/IP/hour
3. CAPTCHA check (optional, rate-based)
4. Scout runs:
   - nmap quick scan (top 100 ports)
   - amass passive subdomain enumeration
   - nuclei critical + high severity templates only
   - whatweb technology fingerprint
5. Results rendered inline; no page reload
6. Below results: CTA box

┌─────────────────────────────────────────────┐
│  We found 3 critical CVEs on your domain.   │
│  Carina can exploit and validate them.       │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Already use Hermes or OpenClaw?      │   │
│  │  One command. Your setup comes too.   │   │
│  │                                      │   │
│  │  $ carina import from-hermes          │   │
│  │  $ carina scout investigate <id>      │   │
│  │                                      │   │
│  │  [Get Carina Free]  [View Plans]      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### API Endpoint

```
POST /api/v1/free-scan
  Body: { "domain": "example.com" }
  Response: {
    "scan_id": "...",
    "status": "running",
    "eta_seconds": 90
  }

GET /api/v1/free-scan/{scan_id}
  Response: {
    "status": "completed",
    "duration_seconds": 87,
    "findings": {
      "critical": 3,
      "high": 7,
      "medium": 12
    },
    "details": [
      {
        "tool": "nuclei",
        "name": "CVE-2024-1234",
        "severity": "critical",
        "cvss": 9.8,
        "description": "nginx RCE..."
      }
    ],
    "attack_surface": {
      "open_ports": [22, 80, 443, 8080],
      "subdomains": ["www", "mail", "admin", "api", "dev"],
      "tech_stack": ["nginx/1.24.0", "php/8.1"]
    },
    "cta": {
      "message": "Carina can validate these CVEs. Import your Hermes setup.",
      "import_command": "carina import from-hermes",
      "signup_url": "/signup"
    }
  }
```

### Rate Limiting

```
Per IP: 1 scan per hour (free tier)
Per domain: 1 scan per 24 hours (prevent abuse)
Captcha: triggered after 3 scans in 24 hours from same IP
```

### CTA Variants (shown based on detected agents)

```
If ~/.hermes/ detected (via browser can't know; shown post-Carina install):
  "We detected Hermes on your machine. Import everything in one command."

If unknown:
  "Already use an AI agent? Carina imports from Hermes, OpenClaw & Odysseus."

If returning user (cookie):
  "Your last scan found 5 CVEs. 3 are still unresolved. Deep scan with Carina."
```

---

## 2.2 Roadmap: Free Scout

**Build Time:** 1 week
**Team:** 1 full-stack dev

```
Day 1-2: Backend
   POST /api/v1/free-scan endpoint
   Rate limiting middleware
   Scan orchestration (nmap + amass + nuclei + whatweb)
   GET /api/v1/free-scan/{id} polling endpoint

Day 3-4: Frontend
   Landing page (scout.carinaai.uk/free)
   Domain input + SCAN button
   Progress animation (scanning... 45s... 90s...)
   Results display (severity badges, CVE cards, attack surface map)
   CTA box with dynamic content

Day 5: Polish
   Mobile responsive
   Error states (invalid domain, timeout, rate limited)
   Share results link
   "Scan another domain" flow
```

### Deliverables
- `scout/src/routes/free-scan.ts`; API endpoints
- `scout/src/pages/free.tsx`; Landing page
- `scout/src/components/ScanResults.tsx`; Results component
- `scout/src/components/CTABox.tsx`; Import CTA
- nginx config: `scout.carinaai.uk/free` route

---

# PART 3: COMMUNITY BRIDGE; SKILLS FOR THEIR ECOSYSTEMS

## 3.1 Prompt: Publish Carina Skills to Hermes & OpenClaw

### GOAL
Make Carina visible inside Hermes and OpenClaw BEFORE users install Carina. Publish Carina security tools as skills they can install in their current agent. Every skill ends with a "Full power in Carina" call to action.

### SKILL PACKAGES TO PUBLISH

#### Package 1: carina-security-scanner (Hermes + OpenClaw)

```markdown
# carina-security-scanner

Quick security scan of any domain. Runs nmap + nuclei and returns
open ports, CVEs, and attack surface summary.

## Install
hermes skills install carina-security-scanner

## Usage
Scan my domain example.com for vulnerabilities

## What it does
1. Port scan (top 100 ports)
2. CVE detection (critical + high)
3. Technology fingerprint
4. Attack surface summary

---
 Full power: Carina has 72 security tools, forensics, and compliance.
  carina import from-hermes  →  Your entire Hermes setup comes with you.
  https://carinaai.uk
```

#### Package 2: carina-subdomain-watch (Hermes + OpenClaw)

```markdown
# carina-subdomain-watch

Continuous subdomain monitoring. Alerts when new subdomains appear.

## Install
hermes skills install carina-subdomain-watch

## Usage
Watch subdomains for example.com

---
 Carina automates this daily. 71 more tools included.
```

#### Package 3: carina-compliance-reporter (OpenClaw)

```markdown
# carina-compliance-reporter

Generate SOC2/ISO27001 compliance reports for your infrastructure.

## Install
openclaw skills install carina-compliance-reporter

---
 Carina's enterprise governance does this continuously with audit trails.
```

### Implementation

```typescript
// scripts/publish-to-hermes.ts
// Script that takes a Carina skill and publishes it as a Hermes-compatible skill

function carinaSkillToHermes(carinaSkill: CarinaSkill): HermesSkill {
  return {
    name: `carina-${carinaSkill.name}`,
    description: carinaSkill.description,
    content: carinaSkill.content + '\n\n---\n Full power: [Carina](https://carinaai.uk) has 72 security tools.',
    // Remove Carina-specific frontmatter, add Hermes-compatible keys
  };
}

function carinaSkillToOpenClaw(carinaSkill: CarinaSkill): OpenClawSkill {
  return {
    name: `carina-${carinaSkill.name}`,
    description: carinaSkill.description,
    systemPrompt: carinaSkill.content,
    // OpenClaw uses different format
  };
}
```

### Publishing Channels

| Platform | Format | Audience | Action |
|----------|--------|----------|--------|
| Hermes skill hub | SKILL.md | Hermes users | PR to hermes-agent/skills repo |
| OpenClaw registry | .clawskill | OpenClaw users | Publish to OpenClaw registry |
| Reddit r/hermesagent | Post | Community | "Carina security scanner for Hermes" |
| Discord (Hermes/OpenClaw) | Bot command | Active users | `!skill carina-security-scanner` |
| GitHub Gist | Single file | Developers | Quick install |

### Skill Content Template

Every published skill follows this structure:

```markdown
---
name: carina-<toolname>
description: <one line>
version: 1.0.0
author: Carina
homepage: https://carinaai.uk
---

# <Tool Name>

<What it does; 2-3 sentences. Value-first.>

## Install
hermes skills install carina-<toolname>

## Usage
<Example prompt the user sends to their agent>

## What you get
<Bullet list of outputs>

## Requirements
<Tool must be installed on your machine: nmap, nuclei, etc.>

---
 **Want 71 more security tools?**
Carina imports your entire Hermes setup in one command.
`carina import from-hermes`; your skills, config, and history come too.
[Get Carina](https://carinaai.uk)
```

---

## 3.2 Roadmap: Community Bridge

**Build Time:** 2 weeks
**Team:** 1 dev + marketing

### Week 1
```
Day 1-2: Skill conversion scripts
   carinaSkillToHermes() converter
   carinaSkillToOpenClaw() converter
   Template system for CTA footer

Day 3-5: Content creation
   carina-security-scanner skill (nmap + nuclei wrapper)
   carina-subdomain-watch skill (amass wrapper)
   carina-compliance-reporter skill (STIX report gen)
   carina-obsidian-vault skill (export to Obsidian)
   Each with proper CTA, docs, examples
```

### Week 2
```
Day 1-2: Publishing
   PR to hermes-agent/skills GitHub repo
   Publish to OpenClaw registry
   Create carinaai.uk/skills landing page

Day 3-4: Community outreach
   Reddit posts in r/hermesagent, r/openclaw, r/netsec
   Discord announcements
   Twitter/X thread: "72 security tools. Here's 5 free for Hermes."

Day 5: Analytics
   Track installs per platform
   Track CTA clicks
   A/B test CTA wording
```

### Deliverables
- `scripts/publish-to-hermes.ts`
- `scripts/publish-to-openclaw.ts`
- 5 published skills with CTAs
- `carinaai.uk/skills` landing page

---

# PART 4: ENTERPRISE CISO PITCH

## 4.1 Prompt: CISO Landing Page + Collateral

### GOAL
Package Scout as "AI Agent Governance Platform"; sell to CISOs who need visibility, compliance, and audit trails for their team's AI agent usage.

### LANDING PAGE COPY

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   Your developers use AI agents.                 │
│   Who's watching what those agents do?           │
│                                                  │
│   Scout; AI Agent Governance Platform           │
│                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │ See      │  │ Comply   │  │ Trust    │      │
│   │ every    │  │ with     │  │ your     │      │
│   │ agent    │  │ SOC2 &   │  │ audit    │      │
│   │ action   │  │ ISO27001 │  │ trail    │      │
│   └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│   [Request Demo]  [Security Whitepaper]          │
│                                                  │
└──────────────────────────────────────────────────┘
```

### CISO Pain Points → Carina Answers

| CISO Pain Point | Carina Answer |
|----------------|---------------|
| "I don't know what AI agents my team uses" | Scout detects agent activity across infrastructure |
| "An agent could deploy vulnerable code" | Scout scans every deployment, every domain |
| "Auditors want AI governance proof" | Carina generates immutable audit trails |
| "We're pursuing SOC2 certification" | Carina's compliance automation maps to SOC2 controls |
| "Shadow IT; agents I don't know about" | Scout discovers exposed services from ANY agent |
| "Incident response; what did the agent do?" | Forensic timeline with chain of custody |
| "Board wants AI risk assessment" | Weekly Scout Score + executive summary |

### One-Pager Structure

```
Page 1: The Problem
  "472% increase in AI agent usage. 0% increase in AI agent governance."
  "Your developers adopted Hermes. Your auditors are asking questions."

Page 2: The Solution
  "Scout sits on top of any AI agent. Hermes, OpenClaw, Odysseus; doesn't matter."
  "One dashboard. Every agent action. Every exposed surface. Every compliance report."

Page 3: How It Works
  1. Connect your infrastructure (domains, IPs, cloud accounts)
  2. Scout continuously monitors
  3. Dashboard shows: Scout Score, open CVEs, attack surface, agent activity
  4. Compliance reports auto-generated

Page 4: Compliance Mapping
  SOC2 CC6.1: Scout monitors all infrastructure changes
  SOC2 CC7.1: Scout detects vulnerabilities before exploitation
  ISO27001 A.12.6: Scout provides continuous vulnerability assessment
  ISO27001 A.16.1: Scout enables incident response with forensic timeline

Page 5: Pricing
  Enterprise: Quote (custom targets, white-label, on-prem, SSO, SLA, dedicated support)
  Custom: Unlimited targets, white-label, on-prem deployment option

Page 6: CTA
  "Your competitors are already using AI agents. Govern yours before your board asks."
  [Request Demo] [Download Whitepaper]
```

### Email Sequence (CISO Nurture)

```
Email 1 (Day 0): "Your developers use AI agents. Can you prove they're secure?"
  → Problem awareness
  → Link to blog post: "The CISO's Guide to AI Agent Governance"

Email 2 (Day 3): "What Scout found on a Fortune 500 company's AI-deployed infra"
  → Case study/report
  → 23 critical CVEs, 4 exposed admin panels, 0 governance

Email 3 (Day 7): "SOC2 auditors are asking about AI. Here's what to show them."
  → Compliance mapping doc
  → "Carina generates this automatically"

Email 4 (Day 14): "Demo: See what your agents are exposing in 15 minutes"
  → Calendar link
  → "No commitment. Just visibility."

Email 5 (Day 21): "Your board will ask about AI risk this quarter."
  → Board-ready executive summary template
  → "Carina generates this weekly."
```

---

## 4.2 Roadmap: Enterprise CISO Launch

**Build Time:** 2 weeks (alongside other work)
**Team:** 1 marketer + 1 designer

```
Week 1:
   CISO landing page (scout.carinaai.uk/enterprise)
   One-pager PDF
   Compliance mapping document (SOC2 + ISO27001 + GDPR)
   Blog post: "The CISO's Guide to AI Agent Governance"

Week 2:
   Whitepaper: "AI Agent Security: A New Attack Surface"
   Email sequence (5 emails)
   Demo script + slide deck
   LinkedIn/Twitter campaign targeting CISOs
   Case study template
```

---

# PART 5: COMPLETE ROADMAP; ALL STRATEGIES

## Master Timeline (6 Weeks)

```
WEEK 1; Import Tools + Free Scout
├── [DEV] Import tools: Hermes parser (skills + config + sessions)
├── [DEV] Import tools: OpenClaw parser (agents + skills + history)
├── [DEV] Free Scout backend: scan endpoint + rate limiting
├── [DESIGN] Free Scout landing page design
└── [MARKETING] CISO landing page copy

WEEK 2; Import Tools + Free Scout Launch
├── [DEV] Import tools: Odysseus parser
├── [DEV] Import tools: dry-run + reports + testing
├── [DEV] Free Scout frontend: results + CTA
├── [LAUNCH] Free Scout live at scout.carinaai.uk/free
├── [LAUNCH] carina import from-hermes live
└── [MARKETING] Blog post: "Import your Hermes setup to Carina in 1 command"

WEEK 3; Community Bridge
├── [DEV] Skill converters: Carina → Hermes, Carina → OpenClaw
├── [CONTENT] carina-security-scanner skill
├── [CONTENT] carina-subdomain-watch skill
├── [CONTENT] carina-compliance-reporter skill
├── [PUBLISH] Submit to Hermes skill hub + OpenClaw registry
├── [MARKETING] Reddit, Discord, Twitter posts
└── [ANALYTICS] Track install + CTA click metrics

WEEK 4; Enterprise CISO
├── [DESIGN] Enterprise landing page
├── [CONTENT] CISO one-pager PDF
├── [CONTENT] Compliance mapping doc
├── [CONTENT] Whitepaper
├── [CONTENT] Email sequence
└── [OUTREACH] LinkedIn campaign

WEEK 5; Polish + Iterate
├── [ANALYTICS] Review free Scout metrics
├── [ANALYTICS] Review import tool usage
├── [ANALYTICS] Review CISO demo requests
├── [CONTENT] More skills for Hermes/OpenClaw
├── [OPTIMIZE] A/B test CTAs
└── [FIX] Bugs from launch

WEEK 6; Scale
├── [OUTREACH] Targeted CISO outreach (LinkedIn Sales Navigator)
├── [CONTENT] Case studies from early users
├── [CONTENT] Video demo: "Import from Hermes in 30 seconds"
├── [PARTNERSHIP] Reach out to Hermes/OpenClaw for co-marketing
└── [METRICS] Full funnel report: visits → scans → imports → paid
```

## Metrics Dashboard (What to Track)

```
FUNNEL:
  scout.carinaai.uk/free visitors    → Target: 500/week by week 6
  Free scans completed               → Target: 200/week
  Carina installs from CTA           → Target: 50/week
  carina import from-hermes runs     → Target: 20/week
  Paid conversions (any plan)        → Target: 5/week

COMMUNITY:
  Hermes skills published            → Target: 5 skills
  Hermes skill installs              → Target: 100 total
  OpenClaw skill installs            → Target: 50 total
  GitHub stars on converter repo     → Target: 100

ENTERPRISE:
  CISO landing page visitors         → Target: 200/week
  Whitepaper downloads               → Target: 50/week
  Demo requests                      → Target: 5/week
  Enterprise deals closed            → Target: 1 by week 12
```

---

# PART 6: REQUIRED FILES

## Files to Create

```
carina/
├── src/
│   ├── cli/commands/import.ts          ← NEW: carina import command
│   ├── import/
│   │   ├── types.ts                    ← NEW: ImportSource, ImportReport
│   │   ├── parsers/
│   │   │   ├── hermes.ts               ← NEW: Hermes parsers
│   │   │   ├── openclaw.ts             ← NEW: OpenClaw parsers
│   │   │   └── odysseus.ts             ← NEW: Odysseus parsers
│   │   └── detector.ts                 ← NEW: Installation detection
│   └── integrations/
│       └── obsidian-vault.ts           ← EXISTING: from OBSIDIAN-INTEGRATION.md
│
├── scout/
│   ├── src/
│   │   ├── routes/
│   │   │   └── free-scan.ts            ← NEW: Free scan API
│   │   └── pages/
│   │       └── free.tsx                 ← NEW: Free scan landing page
│   └── public/
│       └── free/
│           └── index.html              ← Fallback static version
│
├── scripts/
│   ├── publish-to-hermes.ts            ← NEW: Skill converter
│   └── publish-to-openclaw.ts          ← NEW: Skill converter
│
├── marketing/
│   ├── ciso-one-pager.pdf              ← NEW: CISO collateral
│   ├── compliance-mapping.pdf          ← NEW: SOC2/ISO mapping
│   └── email-sequence.md               ← NEW: CISO nurture emails
│
└── instructions/gap-analysis/03-gaps-5-partial-closing/
    └── gap-05-security-gold-standard/
        ├── MIGRATION-STRATEGY.md        ← EXISTING: Strategy doc
        ├── OBSIDIAN-INTEGRATION.md      ← EXISTING: Obsidian spec
        ├── SCOUT-CARINA-ARCHITECTURE.md ← EXISTING: Full architecture
        └── MIGRATION-IMPLEMENTATION.md  ← THIS FILE
```

---

## APPENDIX: One-Sentence Pitches

| Audience | Pitch |
|----------|-------|
| Developer | "Carina imports your Hermes setup in one command. You lose nothing. You gain 72 security tools." |
| CISO | "Your developers already use AI agents. Scout shows you what they're exposing. No agent change required." |
| Pentester | "Carina is the only agent that goes from recon to exploitation to forensic report; autonomously." |
| Compliance Officer | "SOC2 requires AI governance. Carina generates the audit trail your auditors need." |
| CTO | "One platform that both your developers AND your security team will love." |

---

## SUCCESS METRICS (90-Day Targets)

| Metric | Current | 30-Day | 60-Day | 90-Day |
|--------|---------|--------|--------|--------|
| `carina import` runs | 0 | 50 | 200 | 500 |
| Free scans completed | 0 | 100 | 500 | 2000 |
| Skills published to Hermes | 0 | 5 | 10 | 15 |
| CISO demo requests | 0 | 3 | 10 | 25 |
| Paid conversions (all) | 0 | 5 | 20 | 50 |
| Carina installs | current | +20% | +50% | +100% |
| GitHub stars | current | +50 | +200 | +500 |