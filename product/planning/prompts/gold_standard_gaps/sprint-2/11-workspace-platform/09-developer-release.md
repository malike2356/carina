# Prompt 09: Developer Platform Release

## Context

The Workspace Platform becomes a developer platform when external teams can build distros
without reading the Carina source code. This prompt creates the developer-facing release:
an SDK package, developer docs, and a "Hello World" distro example that can be built and
run in under 10 minutes.

## What to Build

### 1. `@verlox/carina-sdk` package

Create `packages/sdk/` with the types and helpers distro developers need:
```typescript
// packages/sdk/src/index.ts

export { defineSkill } from './skill';
export { defineTool } from './tool';
export { defineWorkflow } from './workflow';
export type { SkillDefinition } from './skill';
export type { ToolDefinition } from './tool';
export type { WorkflowContext } from './workflow';
export type { DistroConfig, DistroBranding, DistroUIConfig } from './distro-types';
```

`defineSkill` and `defineTool` are typed wrappers that enforce the correct shape and
surface TypeScript IntelliSense for the parameters.

### 2. SDK `defineSkill`

```typescript
// packages/sdk/src/skill.ts
export function defineSkill<P extends SkillParameters>(def: SkillDefinition<P>): SkillDefinition<P> {
  return def; // type-level validation only; runtime validation done by Carina loader
}

export type SkillDefinition<P extends SkillParameters = Record<string, SkillParam>> = {
  name: string;
  description: string;
  tools?: string[];
  parameters?: P;
  prompts?: Record<string, string>;
  execute?: (args: InferParams<P> & { tenantId: string }) => Promise<unknown>;
};
```

### 3. Developer docs

In `docs.carinaai.uk/docs/developer/`:

**distro-quickstart.md:**
```markdown
# Build Your First Distro (5 minutes)

## Prerequisites
- Carina CLI installed: npm install -g @verlox/carina
- Node.js 22+

## Step 1: Create a distro
carina distro create

## Step 2: Run in dev mode
carina distro dev --distro ./my-distro/carina.distro.json

## Step 3: Add a skill
carina distro add my-skill

## Step 4: Build and publish
carina distro build
carina skills publish ./my-skill.ts
```

**distro-reference.md:** Full reference for all carina.distro.json fields.

**skill-reference.md:** defineSkill API reference with examples.

### 4. Hello World distro

Create `examples/hello-world/`:
```
examples/hello-world/
  carina.distro.json
  prompts/system.md
  skills/greet.ts
  README.md
```

`carina.distro.json`:
```json
{
  "id": "hello-world",
  "name": "Hello World Distro",
  "version": "0.1.0",
  "description": "Minimal working distro example",
  "systemPrompt": { "file": "prompts/system.md" },
  "skills": { "required": ["greet"] },
  "tools": { "allowed": ["web-search"], "blocked": [] },
  "channels": { "enabled": ["web"], "disabled": [] },
  "memory": { "namespace": "hello-world", "isolate": false }
}
```

### 5. Developer changelog and versioning

Tag the first developer release:
```bash
git tag v0.5.0-developer-preview
```

Add `CHANGELOG.md` entry:
```markdown
## v0.5.0-developer-preview (2026-Q3)

This release introduces the Carina Workspace Platform developer preview.

### New
- carina.distro.json format v1 schema
- carina distro create/dev/validate/build/install commands
- @verlox/carina-sdk - defineSkill, defineTool, defineWorkflow helpers
- @verlox/carina-ui - shared React component library
- ABBIS distro (packages/distros/abbis/) - reference implementation
- Propreneur distro (packages/distros/propreneur/) - live example

### Developer preview notes
- distro.json schema is not yet stable - breaking changes possible
- @verlox/carina-sdk is 0.x - no SemVer guarantees until 1.0
```

## Verification Checklist

- [ ] `npm install @verlox/carina-sdk` and use `defineSkill` - TypeScript IntelliSense works
- [ ] Follow the quickstart doc: new distro works in under 10 minutes from scratch
- [ ] `examples/hello-world/` runs with `carina distro dev --distro ./examples/hello-world/carina.distro.json`
- [ ] Developer docs are published at `docs.carinaai.uk/developer/distro-quickstart`
- [ ] `git tag v0.5.0-developer-preview` exists in the repo

## Files to Create or Modify

- CREATE `packages/sdk/package.json`
- CREATE `packages/sdk/src/index.ts`
- CREATE `packages/sdk/src/skill.ts`
- CREATE `packages/sdk/src/tool.ts`
- CREATE `packages/sdk/src/workflow.ts`
- CREATE `examples/hello-world/` (all files)
- CREATE `docs.carinaai.uk/docs/developer/distro-quickstart.md`
- CREATE `docs.carinaai.uk/docs/developer/distro-reference.md`
- CREATE `docs.carinaai.uk/docs/developer/skill-reference.md`
- CREATE `CHANGELOG.md`
- MODIFY `pnpm-workspace.yaml` - add `packages/sdk`
