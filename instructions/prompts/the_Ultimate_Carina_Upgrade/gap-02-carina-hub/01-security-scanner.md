# Gap 02 - File 1: Hub Security Scanner

Agent: Claude Code (primary), Codex (fallback)
Estimated time: 3-4 hours

---

## Context

The Carina Skills Hub is a public marketplace for skill packs. Users
submit YAML/markdown skill content via `POST /api/marketplace/publish` in
`core.carinaai.uk/src/skills/hub/server.ts`. Right now that endpoint
validates structure (via marketplace-validate.ts) but never checks the
submitted content for malicious patterns.

The sandbox system already exists at
`core.carinaai.uk/src/sandbox/sandbox-factory.ts` - it exports
`runInSandbox(code, language, timeoutMs, options)` which runs code in a
worker thread or Docker container with network disabled.

The prompt guard already exists at
`core.carinaai.uk/src/security/prompt-guard.ts` - read it carefully; it
exports types `InjectionResult` and `InjectionPattern`, and reads
patterns from the JSON file alongside it.

The goal: before a community submission is approved, run it through a
static security scanner. Clean submissions get `trust.validation =
'passed'` and a "community" badge. Flagged submissions get `trust.validation
= 'pending'` and enter a human review queue.

---

## Step 1: Read these files first

Read them in this order:

1. `src/skills/hub/validate.ts` - existing static checks (SENSITIVE
   patterns, env file detection)
2. `src/security/prompt-guard.ts` - InjectionResult interface, how
   patterns are matched
3. `src/security/injection-patterns.json` - the pattern array structure
4. `src/sandbox/sandbox-factory.ts` - runInSandbox signature and
   SandboxResult type
5. `src/skills/hub/server.ts` lines 246-269 - the POST
   /api/marketplace/publish handler where the scan must be called
6. `src/skills/hub/migrations.ts` - current hub_skills table schema (you
   will add a column)

---

## Step 2: Add security_verdict column migration

In `src/skills/hub/migrations.ts`, append to the `HUB_ALTER` constant
(the string that runs ALTER TABLE statements):

```sql
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS security_verdict TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS security_flags JSONB NOT NULL DEFAULT '[]';
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS security_verdict TEXT NOT NULL DEFAULT 'pending';
```

Do not change the CREATE TABLE statements.

---

## Step 3: Create src/skills/hub/hub-security-scanner.ts

Create this new file. It must stay under 120 lines.

```typescript
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { InjectionPattern } from '../../security/prompt-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXFIL_PATTERNS = [
  /fetch\s*\(/,
  /axios\s*\./,
  /http\.get\s*\(/,
  /https\.get\s*\(/,
  /XMLHttpRequest/,
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /exec\s*\(/,
  /spawn\s*\(/,
  /process\.env\b/,
];

const SHELL_INJECTION_PATTERNS = [
  /`[^`]*\$\{/,
  /exec\s*\(\s*['"`]/,
  /execSync\s*\(/,
  /spawnSync\s*\(/,
  /\$\(\s*.*\)/,
];

const HARDCODED_CREDENTIAL_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
  /password\s*[:=]\s*['"]?[^\s'"]{6,}/i,
  /secret\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
];

const FILE_OPS_OUTSIDE_WORKSPACE = [
  /fs\s*\.\s*(readFile|writeFile|unlink|rm|rmdir|mkdir|rename)\s*\(\s*['"]\//,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /path\.resolve\s*\(\s*['"]\//,
];

export interface ScanVerdict {
  passed: boolean;
  badge: 'community' | 'review_required';
  flags: string[];
}

export async function scanSkillContent(content: string): Promise<ScanVerdict> {
  const flags: string[] = [];

  for (const re of EXFIL_PATTERNS) {
    if (re.test(content)) {
      flags.push(`exfiltration_pattern:${re.source.slice(0, 40)}`);
    }
  }

  for (const re of SHELL_INJECTION_PATTERNS) {
    if (re.test(content)) {
      flags.push(`shell_injection:${re.source.slice(0, 40)}`);
    }
  }

  for (const re of HARDCODED_CREDENTIAL_PATTERNS) {
    if (re.test(content)) {
      flags.push(`hardcoded_credential:${re.source.slice(0, 40)}`);
    }
  }

  for (const re of FILE_OPS_OUTSIDE_WORKSPACE) {
    if (re.test(content)) {
      flags.push(`file_op_outside_workspace:${re.source.slice(0, 40)}`);
    }
  }

  await scanWithInjectionPatterns(content, flags);

  const passed = flags.length === 0;
  return {
    passed,
    badge: passed ? 'community' : 'review_required',
    flags,
  };
}

async function scanWithInjectionPatterns(content: string, flags: string[]): Promise<void> {
  try {
    const patternsPath = path.resolve(__dirname, '../../security/injection-patterns.json');
    const raw = await fs.readFile(patternsPath, 'utf-8');
    const patterns = JSON.parse(raw) as InjectionPattern[];
    for (const p of patterns) {
      if (p.severity === 'critical' || p.severity === 'high') {
        const re = new RegExp(p.pattern, p.flags ?? 'i');
        if (re.test(content)) {
          flags.push(`prompt_injection:${p.id}`);
        }
      }
    }
  } catch {
    // injection-patterns.json unavailable - skip layer
  }
}
```

---

## Step 4: Wire the scanner into POST /api/marketplace/publish

In `src/skills/hub/server.ts`, find the handler for
`app.post('/api/marketplace/publish', ...)` (around line 246). After the
line that calls `validateMarketplaceEntryInput(req.body, ...)` and before
the `upsertHubMarketplaceEntry` call, insert:

```typescript
const { scanSkillContent } = await import('./hub-security-scanner.js');
const contentToScan = [
  input.description,
  input.name,
  JSON.stringify(input.install),
].join('\n');
const verdict = await scanSkillContent(contentToScan);

input.trust = {
  ...input.trust,
  publisher: 'community',
  validation: verdict.passed ? 'passed' : 'pending',
  verified: false,
};
```

Remove the existing lines that hardcode `publisher: 'community'`,
`validation: 'pending'`, and `verified: false` (they are already there -
replace them with the block above).

The response JSON already returns `pendingVerification: true`. Change
it to use the verdict:

```typescript
res.status(201).json({
  id: input.id,
  pendingVerification: !verdict.passed,
  badge: verdict.badge,
  flags: verdict.passed ? [] : verdict.flags,
});
```

---

## Step 5: Sandbox execution scan (optional fast path)

The static scan in Step 3 covers most cases. If `CARINA_HUB_SANDBOX_SCAN=true`
is set in the environment, also run the skill JavaScript through the worker
sandbox to catch runtime exfiltration. Add this to `scanSkillContent`
after the static checks:

```typescript
if (process.env.CARINA_HUB_SANDBOX_SCAN === 'true') {
  const jsBlocks = extractJsBlocks(content);
  for (const block of jsBlocks) {
    const { runInSandbox } = await import('../../sandbox/sandbox-factory.js');
    const result = await runInSandbox(block, 'javascript', 5000, { networkDisabled: true });
    if (result.stderr.includes('fetch') || result.stderr.includes('http')) {
      flags.push('sandbox:network_attempt_detected');
    }
  }
}
```

Add a helper at the bottom of the file:

```typescript
function extractJsBlocks(content: string): string[] {
  const matches = content.matchAll(/```(?:js|javascript)\n([\s\S]*?)```/g);
  return [...matches].map((m) => m[1]);
}
```

---

## Files to create or modify

| File | Action |
|---|---|
| `src/skills/hub/hub-security-scanner.ts` | CREATE |
| `src/skills/hub/server.ts` | MODIFY (wire scanner into publish handler) |
| `src/skills/hub/migrations.ts` | MODIFY (add security_verdict + security_flags columns) |

---

## Done-when criteria

- [ ] `hub-security-scanner.ts` exists and compiles (`pnpm build`)
- [ ] `POST /api/marketplace/publish` calls `scanSkillContent` before
  writing to the database
- [ ] A submission containing `process.env` or a hardcoded `sk-` key
  returns `pendingVerification: true` and `badge: 'review_required'`
- [ ] A clean submission returns `badge: 'community'` and
  `pendingVerification: false`
- [ ] `hub_skills` table has `security_verdict` and `security_flags`
  columns after migration
- [ ] `pnpm test` still passes (do not break existing tests)

---

## Do NOT do

- Do not add routes to list the review queue (that is an ops panel task)
- Do not run the sandbox scan synchronously on every request if Docker is
  not available; the `CARINA_HUB_SANDBOX_SCAN` env flag gates it
- Do not modify marketplace-validate.ts (it handles schema validation, not
  content security)
