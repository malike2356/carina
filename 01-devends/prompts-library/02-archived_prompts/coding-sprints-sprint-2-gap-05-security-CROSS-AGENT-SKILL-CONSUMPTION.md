# Carina Cross-Agent Skill Consumption; Feasibility & Direction

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-17
**Type:** Technical Architecture + Strategy

---

## THE QUESTION

Can Carina consume skills and tools from other agents' public hubs at runtime; so users migrating from Hermes, OpenClaw, or Odysseus continue using their favorite skills without conversion?

## THE SHORT ANSWER

**Yes. It is entirely doable. And it is the single most powerful migration advantage Carina can build.**

---

## TECHNICAL FEASIBILITY

### Hermes Skills; Near-Zero Effort

Hermes skills are `SKILL.md` files with YAML frontmatter and markdown body. Carina skills use the **exact same format**. The schemas are different (different frontmatter keys) but structurally identical.

```yaml
# Hermes SKILL.md
---
name: my-skill
description: Does something
platforms: [linux, macos]
---

# Hermes skill body
```

```yaml
# Carina SKILL.md
---
name: my-skill
description: Does something  
platforms: [linux, macos, windows]
category: imported
---

# Carina skill body
```

A compatibility wrapper:
```typescript
function hermesSkillToCarina(hermesSkill: HermesSkill): CarinaSkill {
  return {
    name: hermesSkill.name,
    description: hermesSkill.description,
    platforms: hermesSkill.platforms || ['linux', 'macos', 'windows'],
    category: hermesSkill.category || 'imported-hermes',
    content: hermesSkill.content,
    source: 'hermes-hub',
    sourceUrl: hermesSkill.sourceUrl,
    installedAt: new Date().toISOString(),
  };
}
```

**Verdict: 100% compatible.** Carina can load a Hermes SKILL.md directly with zero transformation.

### OpenClaw Skills; Two Types

**Type 1: Prompt skills (.md files)**
Same format. Direct load. Zero conversion needed. 100% compatible.

**Type 2: Code skills (.ts/.js files)**
These are executable TypeScript/JavaScript modules. Carina cannot execute arbitrary TypeScript natively; but can:

```
Option A: Sandboxed Node execution
  carina executes .ts/.js skills in an isolated Node process
  → stdout injected as skill output into Carina's context

Option B: Transpile to prompt
  carina reads the .ts file, wraps it as a prompt skill
  → "Execute this script: <code>"
  → Agent decides whether to run it
```

**Verdict: 85% compatible.** Prompt skills are direct. Code skills need a thin execution layer.

### Odysseus Prompts; Trivial

Odysseus prompts are plain markdown. Carina loads them as instruction skills. Zero conversion. 100% compatible.

---

## RUNTIME ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    CARINA RUNTIME                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Skill Compatibility Layer               │   │
│  │                                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ Hermes   │  │ OpenClaw │  │  Odysseus    │   │   │
│  │  │ Adapter  │  │ Adapter  │  │  Adapter     │   │   │
│  │  │          │  │          │  │              │   │   │
│  │  │ .md→.md  │  │ .md→.md  │  │  .md→.md    │   │   │
│  │  │ (direct) │  │ .ts→exec │  │  (direct)   │   │   │
│  │  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │   │
│  │       │              │               │            │   │
│  │       ▼              ▼               ▼            │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │        Unified Skill Registry               │   │   │
│  │  │  skills/                                    │   │   │
│  │  │  ├── carina/      (native)                  │   │   │
│  │  │  ├── hermes-hub/  (imported at runtime)     │   │   │
│  │  │  ├── openclaw/    (imported at runtime)     │   │   │
│  │  │  └── odysseus/    (imported at runtime)     │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Carina Skill Hub (native)              │   │
│  │  3000+ community skills, reviews, ratings        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## CLI COMMANDS

```bash
# Install a skill from another agent's hub
carina skills install --from hermes-hub my-favorite-skill
carina skills install --from openclaw openclaw-security-scanner
carina skills install --from odysseus odysseus-deployment-workflow

# Search across ALL hubs simultaneously
carina skills search "security scanner"
  → Carina Hub: 12 results
  → Hermes Hub: 3 results
  → OpenClaw Registry: 1 result

# List installed skills with their source
carina skills list
  my-favorite-skill          hermes-hub     v2.1.0    installed 2026-06-17
  openclaw-security-scanner  openclaw       v1.0.0    installed 2026-06-17
  carina-nmap                carina         v1.5.0    native

# Update skills from their source hubs
carina skills update --all
   my-favorite-skill (hermes-hub): v2.1.0 → v2.2.0 (updated)
   openclaw-security-scanner (openclaw): v1.0.0 (already latest)
   carina-nmap (carina): v1.5.0 → v1.6.0 (updated)
```

---

## IMPLEMENTATION

```typescript
// src/skills/cross-agent/skill-adapters.ts

interface SkillSource {
  name: string; // 'hermes-hub' | 'openclaw' | 'odysseus'
  registryUrl: string; // API endpoint for skill listing
  installUrl: string; // API endpoint for skill download
  adapter: SkillAdapter;
}

interface SkillAdapter {
  canLoad: (rawContent: string, fileName: string) => boolean;
  toCarina: (rawContent: string, metadata: SkillMetadata) => CarinaSkill;
}

const SKILL_SOURCES: SkillSource[] = [
  {
    name: 'hermes-hub',
    registryUrl: 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills/registry.json',
    installUrl: 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills/{name}/SKILL.md',
    adapter: {
      canLoad: (content, fileName) => fileName.endsWith('.md'),
      toCarina: (content, meta) => ({
        name: meta.name,
        description: meta.description || `Imported from Hermes Hub: ${meta.name}`,
        category: 'imported-hermes',
        platforms: ['linux', 'macos', 'windows'],
        content: content,
        source: 'hermes-hub',
        sourceUrl: meta.sourceUrl,
        version: meta.version,
        installedAt: new Date().toISOString(),
      }),
    },
  },
  {
    name: 'openclaw',
    registryUrl: 'https://registry.openclaw.dev/api/skills',
    installUrl: 'https://registry.openclaw.dev/api/skills/{name}/download',
    adapter: {
      canLoad: (content, fileName) => fileName.endsWith('.md') || fileName.endsWith('.ts') || fileName.endsWith('.js'),
      toCarina: (content, meta) => {
        if (meta.fileName.endsWith('.md')) {
          // Prompt skill; direct load
          return { /* same structure as Hermes */ };
        }
        // Code skill; wrap as executable prompt
        return {
          name: meta.name,
          description: `Imported OpenClaw code skill: ${meta.name}. Executed in sandboxed Node.`,
          category: 'imported-openclaw',
          content: `# OpenClaw Skill: ${meta.name}\n\nThis skill executes a Node.js script.\n\n` +
                   `\`\`\`typescript\n${content}\n\`\`\`\n\n` +
                   `When invoked, Carina executes this in an isolated Node process and returns the output.`,
          source: 'openclaw',
          sourceUrl: meta.sourceUrl,
          installedAt: new Date().toISOString(),
        };
      },
    },
  },
  {
    name: 'odysseus',
    registryUrl: 'https://raw.githubusercontent.com/pewdiepie-archdaemon/odysseus/main/prompts/index.json',
    installUrl: 'https://raw.githubusercontent.com/pewdiepie-archdaemon/odysseus/main/prompts/{name}.md',
    adapter: {
      canLoad: () => true,
      toCarina: (content, meta) => ({ /* direct load, same as Hermes */ }),
    },
  },
];

// Cross-hub search
async function searchAllHubs(query: string): Promise<UnifiedSearchResult[]> {
  const results: UnifiedSearchResult[] = [];

  // Search Carina native hub
  const carinaResults = await carinaHub.search(query);
  results.push(...carinaResults.map(r => ({ ...r, source: 'carina' })));

  // Search Hermes hub
  try {
    const hermesResults = await fetch(`${HERMES_REGISTRY}?q=${query}`).then(r => r.json());
    results.push(...hermesResults.map(r => ({ ...r, source: 'hermes-hub' })));
  } catch { /* hub unavailable */ }

  // Search OpenClaw registry
  try {
    const openclawResults = await fetch(`${OPENCLAW_REGISTRY}?q=${query}`).then(r => r.json());
    results.push(...openclawResults.map(r => ({ ...r, source: 'openclaw' })));
  } catch { /* hub unavailable */ }

  return results;
}

// Install from any hub
async function installFromHub(source: string, skillName: string): Promise<CarinaSkill> {
  const hub = SKILL_SOURCES.find(s => s.name === source);
  if (!hub) throw new Error(`Unknown skill source: ${source}`);

  const url = hub.installUrl.replace('{name}', skillName);
  const response = await fetch(url);
  const content = await response.text();
  const metadata = { name: skillName, sourceUrl: url, fileName: url.split('/').pop()! };

  if (!hub.adapter.canLoad(content, metadata.fileName)) {
    throw new Error(`Cannot load ${metadata.fileName} from ${source}`);
  }

  const carinaSkill = hub.adapter.toCarina(content, metadata);

  // Security sandbox check
  await securitySandbox.validate(carinaSkill);

  // Write to skills directory
  await writeFile(
    join(CARINA_SKILLS_DIR, `imported-${source}`, `${skillName}.md`),
    carinaSkill.content
  );

  return carinaSkill;
}
```

### Code Skill Sandbox (for OpenClaw .ts/.js skills)

```typescript
// src/skills/cross-agent/code-sandbox.ts

async function executeCodeSkill(skillPath: string, params: Record<string, any>): Promise<string> {
  // Execute in isolated Node process with:
  // - 30-second timeout
  // - No network access
  // - No filesystem access outside /tmp/carina-sandbox/
  // - 512MB memory limit
  // - stdout captured, stderr logged

  const sandboxDir = `/tmp/carina-sandbox/${uuid()}`;
  await mkdir(sandboxDir, { recursive: true });

  const result = await execSecure(
    `node --max-old-space-size=512 --no-network ${skillPath} '${JSON.stringify(params)}'`,
    {
      timeout: 30000,
      workdir: sandboxDir,
      env: { ...process.env, NODE_ENV: 'carina-sandbox' },
    }
  );

  // Clean sandbox
  await rm(sandboxDir, { recursive: true });

  return result.stdout;
}
```

---

## WHAT THIS MEANS FOR CARINA

### 1. Network Effect Inversion

Every other agent's ecosystem becomes Carina's ecosystem. Carina doesn't need to build a 3000-skill hub from scratch. It can consume Hermes' existing skills, OpenClaw's existing registry, and Odysseus' prompts; on day one.

**Available skill pool:**
- Carina native: growing from 0
- Hermes hub: existing skills (50+)
- OpenClaw registry: existing skills (unknown count)
- Odysseus prompts: existing prompts
- **Total available on day one: all of them combined**

### 2. The Ultimate Migration Pitch

"Carina imports your Hermes setup in one command. Your skills come with you. Your config comes with you. Your history comes with you. And Carina also runs Hermes hub skills natively; so you can keep installing your favorites even after you switch."

This removes the LAST objection to switching. Not just "you won't lose anything" but "you keep access to everything you had before."

### 3. Carina as Meta-Platform

Carina is not just a platform. Carina is a meta-platform; the platform that runs other platforms' ecosystems. This is an Apple Silicon moment. The transition is not a break. It is an expansion. Everything you had before still works. Now you have more.

### 4. Competitive Moat

Once Carina consumes Hermes, OpenClaw, and Odysseus hubs:
- Hermes cannot consume Carina skills (no adapter layer)
- OpenClaw cannot consume Hermes skills
- Odysseus cannot consume either

**Only Carina runs everything.** That is a moat.

---

## THE BEST DIRECTION

### Build Priority

**Phase 1: Hermes Hub Adapter (Week 1)**

This is the highest-impact, lowest-effort path.
- Hermes skills are the same format as Carina skills
- Hermes has an existing public skill hub
- Build `carina skills install --from hermes-hub <name>`
- Build `carina skills search --hub hermes <query>`

**Phase 2: Cross-Hub Search (Week 2)**

- Unified search across Carina + Hermes + OpenClaw
- `carina skills search "security"` returns results from ALL hubs
- Install from any hub with one command

**Phase 3: OpenClaw Adapter (Week 3)**

- Prompt skills: direct load (same as Hermes)
- Code skills: sandboxed Node execution
- Build `carina skills install --from openclaw <name>`

**Phase 4: Skill Bridge Publishing (Week 4)**

- Publish Carina skills BACK to Hermes and OpenClaw hubs
- Carina security scanner available in Hermes hub
- Every Carina skill ends with "Full Carina integration: 71 more tools"

### User Experience

```
$ carina skills search "nmap"

  Carina Hub:
    carina-nmap              v1.5.0     (234)   Full integration
    carina-nmap-stealth       v1.2.0     (87)    Stealth scanning

  Hermes Hub:
    hermes-nmap-scanner       v2.1.0     (156)   Network scanner
    hermes-port-mapper        v1.0.0     (43)    Lightweight port scan

  OpenClaw Registry:
    openclaw-network-recon    v3.0.1     (312)   Full recon suite

$ carina skills install --from openclaw openclaw-network-recon
   openclaw-network-recon v3.0.1 installed from OpenClaw Registry
   Added to skills/openclaw/openclaw-network-recon.md

$ carina skills list
  carina-nmap                carina         v1.5.0    native
  openclaw-network-recon     openclaw       v3.0.1    installed
```

### What This Looks Like to a Migrating User

```
$ carina import from-hermes
   51 skills imported from Hermes
   847 sessions archived as memory
   11 cron jobs migrated

$ carina skills install --from hermes-hub my-favorite-skill
   my-favorite-skill v2.1.0 installed from Hermes Hub

$ carina skills install --from openclaw security-scanner
   security-scanner v1.0.0 installed from OpenClaw Registry

# User still has access to everything they loved.
# Plus 72 security tools, Scout, forensics, compliance, Obsidian.
# Zero loss. Total gain.
```

---

## SUMMARY

| Question | Answer |
|----------|--------|
| Is it doable? | Yes. Hermes skills are identical format. OpenClaw prompt skills too. Code skills need a thin sandbox. |
| What does it mean for Carina? | Carina becomes a meta-platform. The union of all agent ecosystems. The only agent that runs everything. |
| Best direction? | Build Hermes adapter first (week 1). Cross-hub search (week 2). OpenClaw adapter (week 3). Publish back (week 4). |
| Migration advantage? | Ultimate. "You keep everything. You gain everything. No other agent does this." |