# Production Code De-Referencing; Remove All Competitor Names

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.


**Gap:** 05; Security  
**Status:** Prompt ready  
**Agent (primary):** Claude Code  
**Agent (fallback):** Cursor  
**Estimated effort:** 2 days

---

## Context

11 files across 4 modules hardcode the names "Hermes", "OpenClaw", or "Odysseus" in production code or the public website. These names belong in internal research documents only; never in code, never on the public website, never in environment variables, never in SDK adapters that ship to customers.

This prompt replaces every hardcoded competitor reference with neutral identifiers. Functionality is preserved. Only names change.

---

## Rules

1. **No competitor names in any file under `src/`, `adapters/`, or `public/`.** Comments included.
2. **No competitor names in environment variables.**
3. **No competitor names in the live marketing website.**
4. **Internal research documents (`instructions/`, `strategy/`, `gap-analysis/`, `what_is_carina/`, `_archive-duplicates/`) are EXEMPT.** Do not touch them.
5. **Migration module MUST still work.** Users with `~/.hermes` or `~/.openclaw` directories must still be importable. The path detection is fine. The function names and strings must be neutral.
6. **Scout SDK adapters MUST still work.** The adapter classes and their registration must still function. They just can't be named after competitors.
7. **Benchmark baselines MUST still work.** The comparison data must still be loadable. The labels must be neutral.

---

## Module 1: Scout SDK Adapters (3 files)

**Path:** `labyrinth-scout-sdk/src/adapters/`

### File 1: `hermes-adapter.ts` → `external-agent-adapter.ts`

Rename the file. Rename the class. Rename the export.

| Before | After |
|--------|-------|
| File: `hermes-adapter.ts` | `external-agent-adapter.ts` |
| Class: `HermesAdapter` | `ExternalAgentAdapter` |
| `agentType = 'hermes'` | `agentType = 'compat-agent'` |
| `hermesAdapter` | `externalAgentAdapter` |
| Comment: "Assumption: Hermes agents..." | "Assumption: Compatible agents..." |

### File 2: `openclaw-adapter.ts` → `goal-result-adapter.ts`

The OpenClaw adapter is named after the OpenClaw API pattern (goal/result fields). Rename based on the pattern, not the agent.

| Before | After |
|--------|-------|
| File: `openclaw-adapter.ts` | `goal-result-adapter.ts` |
| Class: `OpenClawAdapter` | `GoalResultAdapter` |
| `agentType = 'openclaw'` | `agentType = 'goal-result'` |
| `openClawAdapter` | `goalResultAdapter` |
| Comment: "Assumption: OpenClaw requests use..." | "Assumption: Goal/result pattern agents..." |

### File 3: `adapter-registry.ts`

Update imports and the adapter array.

| Before | After |
|--------|-------|
| `import { hermesAdapter } from './hermes-adapter.js'` | `import { externalAgentAdapter } from './external-agent-adapter.js'` |
| `import { openClawAdapter } from './openclaw-adapter.js'` | `import { goalResultAdapter } from './goal-result-adapter.js'` |
| `[carinaAdapter, hermesAdapter, openClawAdapter, ...]` | `[carinaAdapter, externalAgentAdapter, goalResultAdapter, ...]` |

---

## Module 2: Migration Module (2 source files + 1 test file)

**Path:** `core.carinaai.uk/src/ops/migration/`

**Architecture change: Replace per-agent migration functions with a single generic `migrate()` function that auto-detects the source agent from the filesystem layout.** No hardcoded agent names anywhere. The module discovers what's in the directory and adapts.

### File 4: `hermes.ts` → DELETE. `openclaw.ts` → DELETE.

Replace both files with a single generic migrator.

**New file: `discovery.ts`**; Scans a source directory and identifies the agent type.

```typescript
// core.carinaai.uk/src/ops/migration/discovery.ts

interface AgentSignature {
  id: string; // Internal type code: 'agent-type-1', 'agent-type-2'
  configFiles: string[]; // Files that identify this agent (e.g., 'config.yaml')
  skillDir: string; // Where skills live relative to root
  skillFormat: 'yaml-md' | 'json-config' | 'markdown' | 'typescript';
  homeDir: string; // Default home directory name (e.g., '.hermes')
}

const AGENT_SIGNATURES: AgentSignature[] = [
  {
    id: 'agent-type-1',
    configFiles: ['config.yaml'],
    skillDir: 'skills',
    skillFormat: 'yaml-md',
    homeDir: '.hermes',
  },
  {
    id: 'agent-type-2',
    configFiles: ['config.yaml', 'agents.yaml'],
    skillDir: 'skills',
    skillFormat: 'yaml-md',
    homeDir: '.openclaw',
  },
];

function discoverAgent(sourcePath: string): AgentSignature | null {
  for (const sig of AGENT_SIGNATURES) {
    const matchCount = sig.configFiles.filter(f =>
      fs.existsSync(path.join(sourcePath, f))
    ).length;
    if (matchCount >= 1) return sig;
  }
  return null; // Generic fallback
}
```

**New file: `migrate.ts`**; Single generic migration function.

```typescript
// core.carinaai.uk/src/ops/migration/migrate.ts

export async function migrate(
  sourcePath: string,
  destPath: string,
  options?: MigrateOptions
): Promise<MigrationReport> {
  const agent = discoverAgent(sourcePath);
  
  if (!agent) {
    return genericMigrate(sourcePath, destPath, options);
  }
  
  // Route to the appropriate migration strategy based on detected signature
  switch (agent.skillFormat) {
    case 'yaml-md':
      return migrateYamlMdSkills(sourcePath, destPath, agent, options);
    case 'json-config':
      return migrateJsonConfig(sourcePath, destPath, agent, options);
    case 'markdown':
      return migrateMarkdownSkills(sourcePath, destPath, agent, options);
    default:
      return genericMigrate(sourcePath, destPath, options);
  }
}

// Migration strategies are named after the FORMAT, not the agent
async function migrateYamlMdSkills(...): Promise<MigrationReport> { ... }
async function migrateJsonConfig(...): Promise<MigrationReport> { ... }
async function migrateMarkdownSkills(...): Promise<MigrationReport> { ... }
async function genericMigrate(...): Promise<MigrationReport> { ... }
```

The migration strategies are named after the **skill format** they handle; `migrateYamlMdSkills`, `migrateJsonConfig`, `migrateMarkdownSkills`. The agent type is an internal code (`agent-type-1`, `agent-type-2`) used only for logging. The report includes the detected type code, not a competitor name.

```typescript
interface MigrationReport {
  source: string; // source path (not agent name)
  sourceType: string; // internal type code: 'agent-type-1'
  sourceFormat: string; // skill format: 'yaml-md'
  filesMigrated: number;
  skillsImported: number;
  warnings: string[];
  manualFollowUp: string[];
}
```

### File 5: `index.ts`

Replace per-agent imports with the generic migrator.

| Before | After |
|--------|-------|
| `import { migrateHermes } from './hermes.js'` | `import { migrate } from './migrate.js'` |
| `import { migrateOpenClaw } from './openclaw.js'` | *(deleted)* |
| `hermes: path.join(os.homedir(), '.hermes')` | *(deleted; discovery auto-finds)* |
| `openclaw: path.join(os.homedir(), '.openclaw')` | *(deleted; discovery auto-finds)* |

The `KNOWN_AGENT_PATHS` constant becomes a simple list of directory names to scan:

```typescript
// Known agent home directories to suggest to users
const KNOWN_AGENT_DIRS = [
  path.join(os.homedir(), '.hermes'),
  path.join(os.homedir(), '.openclaw'),
  path.join(os.homedir(), '.carina'),
];
```

**These paths stay untouched**; they are filesystem locations the user's existing agents use. They are not Carina's names. The discovery engine reads the directory contents to identify the agent type, not the directory name.

### File 6: `migration.test.ts`

Rewrite tests to use the generic `migrate()` function with auto-detection.

```typescript
it('detects agent type from config files', async () => {
  fs.writeFileSync(path.join(tmpDir, 'config.yaml'), 'model:\n  provider: deepseek\n');
  const report = await migrate(tmpDir, tmpDest);
  expect(report.sourceType).toBe('agent-type-1');
});

it('migrates skills regardless of agent type', async () => {
  fs.writeFileSync(path.join(tmpDir, 'config.yaml'), 'model:\n  provider: deepseek\n');
  fs.mkdirSync(path.join(tmpDir, 'skills', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'skills', 'demo', 'SKILL.md'), '# demo\n');
  const report = await migrate(tmpDir, tmpDest);
  expect(report.skillsImported).toBeGreaterThan(0);
});

it('falls back to generic migration for unknown agents', async () => {
  // No config files → generic migration
  const report = await migrate(tmpDir, tmpDest);
  expect(report.sourceType).toBe('unknown');
});
```

Zero test names, variables, or strings reference competitors. Everything is `agent-type-N` or `unknown`.

---

## Module 3: Benchmark Module (2 files)

**Path:** `core.carinaai.uk/src/benchmark/`

### File 7: `competitor-baselines.ts`

Replace all competitor entries with neutral identifiers.

| Before | After |
|--------|-------|
| `{ id: 'hermes', label: 'Hermes', ... }` | `{ id: 'competitor-a', label: 'Competitor A', note: 'General-purpose agent platform (YAML/MD skills, Electron desktop, Ink TUI)' }` |
| `{ id: 'openclaw', label: 'OpenClaw', ... }` | `{ id: 'competitor-b', label: 'Competitor B', note: 'Native-first agent platform (Kotlin/Swift mobile, sensor integration)' }` |
| `{ id: 'odysseus', label: 'Odysseus', ... }` | `{ id: 'competitor-c', label: 'Competitor C', note: 'UI-focused agent workspace (entity anchors, window system, dark theme)' }` |

Keep the `sourceNote` field with descriptive characteristics (no names) so an operator can identify which competitor is which from the description.

Update the header comment:
```
 * These are anonymized baselines from three reference agent platforms.
 * Competitor A: YAML/MD skill format, Electron desktop, Ink TUI
 * Competitor B: Native mobile sensors, Kotlin/Swift, background services
 * Competitor C: Entity anchors, window system, dark-themed UI
```

### File 8: `report.ts`

Update table headers and access patterns.

| Before | After |
|--------|-------|
| `'\| Category \| Carina (measured) \| Hermes (ref) \| OpenClaw (ref) \| Odysseus (ref) \|'` | `'\| Category \| Carina (measured) \| Comp A (ref) \| Comp B (ref) \| Comp C (ref) \|'` |
| `refs.hermes` | `refs.competitorA` |
| `refs.openclaw` | `refs.competitorB` |
| `refs.odysseus` | `refs.competitorC` |

---

## Module 4: Security, Workspace, Cloud (3 files)

### File 9: `core.carinaai.uk/src/security/admin-tool-policy.ts`

| Before | After |
|--------|-------|
| `process.env.ODYSSEUS_PLAN_MODE_ALLOWLIST` | `process.env.CARINA_PLAN_MODE_ALLOWLIST` |

### File 10: `core.carinaai.uk/src/workspace/bootstrap-files.ts`

| Before | After |
|--------|-------|
| Comment: "Workspace bootstrap set (OpenClaw / Hermes pattern)." | "Workspace bootstrap set (agent workspace initialization pattern)." |

### File 11: `app.carinaai.uk/src/lib/cloud-capabilities.ts`

| Before | After |
|--------|-------|
| Comment: "What Carina Cloud actually does today (BYOK chat). No fake Odysseus/core parity." | "What Carina Cloud actually does today (BYOK chat). Core parity roadmap still in development." |

---

**NOTE: The labyrinthscout.com marketing website radar names and comparison table are EXEMPT.** The website is a public-facing comparison tool and can name competitors. Only production source code is de-referenced.

---

## Files to Modify

```
# Scout SDK (3 files)
labyrinth-scout-sdk/src/adapters/hermes-adapter.ts       → external-agent-adapter.ts (RENAME + REWRITE)
labyrinth-scout-sdk/src/adapters/openclaw-adapter.ts     → goal-result-adapter.ts (RENAME + REWRITE)
labyrinth-scout-sdk/src/adapters/adapter-registry.ts      MODIFY imports + array

# Migration (4 files + 2 new)
core.carinaai.uk/src/ops/migration/hermes.ts              DELETE
core.carinaai.uk/src/ops/migration/openclaw.ts            DELETE
core.carinaai.uk/src/ops/migration/discovery.ts           CREATE (new; auto-detection engine)
core.carinaai.uk/src/ops/migration/migrate.ts             CREATE (new; single generic migrator)
core.carinaai.uk/src/ops/migration/index.ts               REWRITE (use migrate() + discovery)
core.carinaai.uk/src/ops/migration/migration.test.ts      REWRITE (generic tests)

# Benchmark (2 files)
core.carinaai.uk/src/benchmark/competitor-baselines.ts    MODIFY entries + labels
core.carinaai.uk/src/benchmark/report.ts                   MODIFY headers + access patterns

# Security / Workspace / Cloud (3 files)
core.carinaai.uk/src/security/admin-tool-policy.ts         MODIFY env var name
core.carinaai.uk/src/workspace/bootstrap-files.ts          MODIFY comment
app.carinaai.uk/src/lib/cloud-capabilities.ts              MODIFY comment
```

**Total: 11 source files modified. 2 deleted. 2 created. 2 renamed. ~2 days with review.**

---

## Verification Checklist

After all changes, run these checks:

```bash
# 1. Zero competitor names in source code (website exempt)
cd /opt/lampp/htdocs/verlox/carina
grep -rIi "hermes" --include="*.ts" --include="*.tsx" --include="*.js" \
  core.carinaai.uk/src/ labyrinth-scout-sdk/src/ app.carinaai.uk/src/ \
  | grep -v node_modules | grep -v '.hermes' | grep -v '.test.'
# Expected: ZERO results (or only test files with compat-agent naming)

grep -rIi "openclaw" --include="*.ts" --include="*.tsx" --include="*.js" \
  core.carinaai.uk/src/ labyrinth-scout-sdk/src/ app.carinaai.uk/src/ \
  | grep -v node_modules | grep -v '.openclaw' | grep -v '.test.'
# Expected: ZERO results

grep -rIi "odysseus" --include="*.ts" --include="*.tsx" --include="*.js" \
  core.carinaai.uk/src/ labyrinth-scout-sdk/src/ app.carinaai.uk/src/ \
  | grep -v node_modules | grep -v '.test.'
# Expected: ZERO results

# 2. Internal docs still have names (should NOT be zero)
grep -rIi "hermes\|openclaw\|odysseus" instructions/ strategy/ gap-analysis/ what_is_carina/ \
  | head -5
# Expected: Results (internal docs are exempt)

# 3. Migration tests pass
cd core.carinaai.uk && pnpm test -- migration

# 4. Build succeeds
cd core.carinaai.uk && pnpm build
cd labyrinth-scout-sdk && pnpm build

# 5. Scout SDK adapter registry loads correctly
node -e "
  const { detectAgentType } = require('./labyrinth-scout-sdk/dist/adapters/adapter-registry.js');
  console.log('Adapter registry OK');
"
```

---

## Done-When Criteria

- [ ] Zero hardcoded "Hermes", "OpenClaw", or "Odysseus" in any source file under `src/`, `adapters/`, or `public/`
- [ ] All 12 files modified. 5 files renamed.
- [ ] Migration module still detects `~/.hermes` and `~/.openclaw` directories
- [ ] Migration tests pass with neutral names
- [ ] Scout SDK adapter registry still loads and detects external agent types
- [ ] Benchmark baselines still load and produce comparison tables
- [ ] Live website shows "Terminal Agent", "Native Agent", "Workspace Agent"; never competitor names
- [ ] `pnpm build` succeeds in both core.carinaai.uk and labyrinth-scout-sdk
- [ ] Internal research documents untouched (spot-check 5 random files)
- [ ] No runtime regressions (Carina starts, connects to gateway, responds to messages)