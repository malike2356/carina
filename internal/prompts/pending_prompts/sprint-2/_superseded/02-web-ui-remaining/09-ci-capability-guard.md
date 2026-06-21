# Prompt 09: CI Capability Guard


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

`core.carinaai.uk/CLAUDE.md` documents verified metrics as of 2026-06-10:
5,369 tests, 23 providers, 18 channel adapters, 71 tools, 16 packs, 96 skills, 49 commands.
Marketing copy on `carinaai.uk`, docs, and the CLI help text must never claim numbers higher
than what the codebase actually implements. A CI check extracts the real numbers and
compares them against the claimed numbers in documentation.

## What to Build

### 1. Capability extractor

Create `scripts/extract-capabilities.ts`:
```typescript
import { glob } from 'glob';
import { readFileSync } from 'fs';

type Capabilities = {
  tools: number;
  providers: number;
  channelAdapters: number;
  skillPacks: number;
  curatedSkills: number;
  cliCommands: number;
  tests: number;
};

async function extract(): Promise<Capabilities> {
  // tools: count entries in TOOLSET_MAP in src/tools/registry.ts
  const registry = readFileSync('src/tools/registry.ts', 'utf-8');
  const toolMatches = registry.match(/'\w+'\s*:/g) ?? [];

  // providers: count entries in src/brain/provider-registry.ts
  const providerReg = readFileSync('src/brain/provider-registry.ts', 'utf-8');
  const providerMatches = providerReg.match(/provider:\s*'\w+'/g) ?? [];

  // channel adapters: count CHANNEL_NAMES entries in src/brain/completion-metadata.ts
  const metadata = readFileSync('src/brain/completion-metadata.ts', 'utf-8');
  const channelMatches = metadata.match(/CHANNEL_NAMES/g) ?? [];

  // skill packs: count directories in src/skills/packs/
  const packs = await glob('src/skills/packs/*/index.ts');

  // curated skills: count skill definitions across all packs
  const skillFiles = await glob('src/skills/packs/**/*.ts', { ignore: ['**/index.ts'] });

  // CLI commands: count commander.command() calls in bin/carina.ts
  const cli = readFileSync('bin/carina.ts', 'utf-8');
  const cmdMatches = cli.match(/\.command\(/g) ?? [];

  return {
    tools: toolMatches.length,
    providers: providerMatches.length,
    channelAdapters: channelMatches.length,
    skillPacks: packs.length,
    curatedSkills: skillFiles.length,
    cliCommands: cmdMatches.length,
    tests: 0, // populated by vitest --reporter=json
  };
}
```

### 2. Capability assertions file

Create `scripts/capability-claims.json`:
```json
{
  "tools": { "claimed": 71, "tolerance": 5 },
  "providers": { "claimed": 23, "tolerance": 3 },
  "channelAdapters": { "claimed": 18, "tolerance": 2 },
  "skillPacks": { "claimed": 16, "tolerance": 2 },
  "curatedSkills": { "claimed": 96, "tolerance": 10 },
  "cliCommands": { "claimed": 49, "tolerance": 5 }
}
```

`tolerance` is how many fewer than claimed is acceptable (features may be temporarily
disabled or refactored). Going ABOVE the claimed count is fine (we add features).
Going BELOW tolerance triggers a CI failure requiring either: fix the feature, or update
the marketing claim.

### 3. Guard script

Create `scripts/check-capabilities.ts`:
```typescript
const actual = await extract();
const claims = JSON.parse(readFileSync('scripts/capability-claims.json', 'utf-8'));

let failed = false;
for (const [key, { claimed, tolerance }] of Object.entries(claims)) {
  const count = actual[key as keyof Capabilities];
  const min = claimed - tolerance;
  if (count < min) {
    console.error(`FAIL: ${key} - claimed ${claimed}, found ${count} (below tolerance of ${min})`);
    failed = true;
  } else {
    console.log(`OK: ${key} - claimed ${claimed}, found ${count}`);
  }
}
if (failed) process.exit(1);
console.log('Capability guard passed.');
```

### 4. CI integration

Add to `.github/workflows/ci.yml`:
```yaml
- name: Capability guard
  run: pnpm check:capabilities
```

Add to `package.json`:
```json
"check:capabilities": "tsx scripts/check-capabilities.ts"
```

### 5. Marketing copy audit

Audit `carinaai.uk/index.html`, `docs.carinaai.uk/docs/`, and `README.md` for specific
number claims. Replace hard-coded numbers with ranges or "up to N" phrasing that stays
valid across minor changes. Example: "71 tools" -> "70+ tools", "23 providers" -> "20+ providers".

## Verification Checklist

- [ ] `pnpm check:capabilities` passes on current codebase with all metrics above tolerance
- [ ] Remove one tool from registry, run check - see failure for tools count
- [ ] CI job fails on a branch that drops below tolerance for any capability
- [ ] Marketing copy uses "N+" phrasing for all counted capabilities

## Files to Create or Modify

- CREATE `scripts/extract-capabilities.ts`
- CREATE `scripts/check-capabilities.ts`
- CREATE `scripts/capability-claims.json`
- MODIFY `package.json` - add check:capabilities script
- MODIFY `.github/workflows/ci.yml` - add capability guard step
- MODIFY `carinaai.uk/index.html` - update hard counts to "N+" ranges
