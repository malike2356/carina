# Cursor Task: Fix and test skills tools (#25-27) in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. This task covers the last three
tools (#25 skills-list, #26 skill-view, #27 skill-manage), all defined in one file:
`src/tools/skills-tools.ts`.

Read these files in full before touching anything:
- `src/tools/skills-tools.ts` (the only source file to change)
- `src/skills/store.ts` (read only - understand what each function can throw)

Do NOT modify any file except `src/tools/skills-tools.ts` and the new test file.

---

## Bug: all three tools let DB errors propagate as unhandled rejections

`listSkills`, `getSkillByName`, `saveSkill`, `updateSkill`, and `deleteSkill` all
call `pool.query(...)` which throws on DB connection failure or constraint violation.
None of the three `execute` functions have any try/catch, so any DB error propagates
out of `execute` instead of returning `{ error: string }`.

### Fix: wrap each tool's DB calls in try/catch

**skillsListTool:**

```typescript
execute: async (params) => {
  const limit = Math.max(1, Math.min(Number(params.limit ?? 50), 200));
  try {
    const skills = await listSkills();
    return {
      count: skills.length,
      skills: skills.slice(0, limit).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        triggers: s.trigger,
        usage_count: s.usageCount,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
},
```

**skillViewTool:**

```typescript
execute: async (params) => {
  const name = String(params.name ?? '').trim();
  if (!name) return { error: 'name is required' };
  try {
    const skill = await getSkillByName(name);
    if (!skill) return { error: `skill not found: ${name}` };
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      triggers: skill.trigger,
      steps: skill.steps,
      tools_used: skill.toolsUsed,
      usage_count: skill.usageCount,
      created_at: skill.createdAt.toISOString(),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
},
```

**skillManageTool:** wrap each action branch individually.

For `create`:
```typescript
if (action === 'create') {
  // ... existing validation ...
  try {
    const existing = await getSkillByName(name);
    if (existing) return { error: `skill already exists: ${name}` };
    const skill = await saveSkill({ name, description, trigger: triggers, steps, toolsUsed });
    return { status: 'created', id: skill.id, name: skill.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
```

For `update`:
```typescript
if (action === 'update') {
  try {
    const existing = await getSkillByName(name);
    if (!existing) return { error: `skill not found: ${name}` };
    // ... build updates object ...
    const skill = await updateSkill(name, updates);
    return { status: 'updated', id: skill.id, name: skill.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
```

For `delete`:
```typescript
if (action === 'delete') {
  try {
    const removed = await deleteSkill(name);
    if (!removed) return { error: `skill not found: ${name}` };
    return { status: 'deleted', name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
```

Keep the final `return { error: 'unknown action: ...' }` unchanged.

---

## Improvement: update descriptions for all three tools

**skillsListTool description:**

```
'List all skills available to the agent (pack skills and user-created). Returns id, name, description, triggers array, and usage_count for each. limit: max skills to return, default 50, max 200. Use skill-view to see full steps for a specific skill.'
```

**skillViewTool description:**

```
'View the full content of a skill by name. Returns id, name, description, triggers, steps (markdown), tools_used, usage_count, and created_at. Use skills-list first to find the exact skill name.'
```

**skillManageTool description:**

```
'Create, update, or delete user skills. action: create - saves a new skill (name, description, steps required; triggers and tools_used optional); update - patches fields on an existing skill by name (only provided fields are changed); delete - removes a skill by name permanently. Requires confirmation for update and delete. Returns status: created/updated/deleted on success.'
```

---

## Create `src/tools/skills-tools.test.ts`

No test file exists. Create it. Mock `../skills/store.js` using `vi.hoisted`.

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  listSkillsMock,
  getSkillByNameMock,
  saveSkillMock,
  updateSkillMock,
  deleteSkillMock,
} = vi.hoisted(() => ({
  listSkillsMock: vi.fn(),
  getSkillByNameMock: vi.fn(),
  saveSkillMock: vi.fn(),
  updateSkillMock: vi.fn(),
  deleteSkillMock: vi.fn(),
}));

vi.mock('../skills/store.js', () => ({
  listSkills: listSkillsMock,
  getSkillByName: getSkillByNameMock,
  saveSkill: saveSkillMock,
  updateSkill: updateSkillMock,
  deleteSkill: deleteSkillMock,
}));

function makeSkill(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'skill-1',
    name: 'test-skill',
    description: 'A test skill',
    trigger: ['keyword'],
    steps: '1. Do something.',
    toolsUsed: ['shell-exec'],
    usageCount: 3,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listSkillsMock.mockResolvedValue([]);
  getSkillByNameMock.mockResolvedValue(null);
  saveSkillMock.mockResolvedValue(makeSkill());
  updateSkillMock.mockResolvedValue(makeSkill());
  deleteSkillMock.mockResolvedValue(false);
});

// ------------------------------------------------------------------ skills-list
describe('skills-list tool', () => {
  it('returns mapped skills array', async () => {
    listSkillsMock.mockResolvedValue([makeSkill()]);
    const { skillsListTool } = await import('./skills-tools.js');
    const result = await skillsListTool.execute({}) as { count?: number; skills?: unknown[] };
    expect(result.count).toBe(1);
    expect((result.skills as Record<string, unknown>[])[0].name).toBe('test-skill');
  });

  it('respects the limit parameter', async () => {
    listSkillsMock.mockResolvedValue(Array.from({ length: 10 }, (_, i) => makeSkill({ id: `s-${i}`, name: `skill-${i}` })));
    const { skillsListTool } = await import('./skills-tools.js');
    const result = await skillsListTool.execute({ limit: 3 }) as { skills?: unknown[] };
    expect(result.skills).toHaveLength(3);
  });

  it('returns error when DB throws', async () => {
    listSkillsMock.mockRejectedValue(new Error('DB connection refused'));
    const { skillsListTool } = await import('./skills-tools.js');
    const result = await skillsListTool.execute({}) as { error?: string };
    expect(result.error).toContain('DB connection refused');
  });
});

// ------------------------------------------------------------------ skill-view
describe('skill-view tool', () => {
  it('returns full skill content', async () => {
    getSkillByNameMock.mockResolvedValue(makeSkill());
    const { skillViewTool } = await import('./skills-tools.js');
    const result = await skillViewTool.execute({ name: 'test-skill' }) as Record<string, unknown>;
    expect(result.steps).toBe('1. Do something.');
    expect(result.tools_used).toEqual(['shell-exec']);
    expect(result.usage_count).toBe(3);
  });

  it('returns error when skill not found', async () => {
    getSkillByNameMock.mockResolvedValue(null);
    const { skillViewTool } = await import('./skills-tools.js');
    const result = await skillViewTool.execute({ name: 'missing' }) as { error?: string };
    expect(result.error).toContain('skill not found');
  });

  it('returns error when name is missing', async () => {
    const { skillViewTool } = await import('./skills-tools.js');
    const result = await skillViewTool.execute({}) as { error?: string };
    expect(result.error).toBe('name is required');
  });

  it('returns error when DB throws', async () => {
    getSkillByNameMock.mockRejectedValue(new Error('query timeout'));
    const { skillViewTool } = await import('./skills-tools.js');
    const result = await skillViewTool.execute({ name: 'test-skill' }) as { error?: string };
    expect(result.error).toContain('query timeout');
  });
});

// ------------------------------------------------------------------ skill-manage
describe('skill-manage tool', () => {
  it('returns error for missing name', async () => {
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({ action: 'create' }) as { error?: string };
    expect(result.error).toBe('name is required');
  });

  it('returns error for unknown action', async () => {
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({ action: 'clone', name: 'x' }) as { error?: string };
    expect(result.error).toContain('unknown action');
  });

  it('create: returns error when description or steps missing', async () => {
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'create',
      name: 'new-skill',
      description: '',
      steps: '',
    }) as { error?: string };
    expect(result.error).toContain('required');
  });

  it('create: returns error when skill already exists', async () => {
    getSkillByNameMock.mockResolvedValue(makeSkill());
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'create',
      name: 'test-skill',
      description: 'A skill',
      steps: '1. Do it.',
    }) as { error?: string };
    expect(result.error).toContain('already exists');
  });

  it('create: returns status:created on success', async () => {
    getSkillByNameMock.mockResolvedValue(null);
    saveSkillMock.mockResolvedValue(makeSkill({ id: 'skill-42', name: 'new-skill' }));
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'create',
      name: 'new-skill',
      description: 'A new skill',
      steps: '1. Run something.',
    }) as { status?: string; id?: string };
    expect(result.status).toBe('created');
    expect(result.id).toBe('skill-42');
  });

  it('update: returns error when skill not found', async () => {
    getSkillByNameMock.mockResolvedValue(null);
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'update',
      name: 'missing',
      description: 'new desc',
    }) as { error?: string };
    expect(result.error).toContain('skill not found');
  });

  it('update: returns status:updated on success', async () => {
    getSkillByNameMock.mockResolvedValue(makeSkill());
    updateSkillMock.mockResolvedValue(makeSkill({ id: 'skill-1', name: 'test-skill' }));
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'update',
      name: 'test-skill',
      description: 'Updated description',
    }) as { status?: string };
    expect(result.status).toBe('updated');
  });

  it('delete: returns error when skill not found', async () => {
    deleteSkillMock.mockResolvedValue(false);
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'delete',
      name: 'missing-skill',
    }) as { error?: string };
    expect(result.error).toContain('skill not found');
  });

  it('delete: returns status:deleted on success', async () => {
    deleteSkillMock.mockResolvedValue(true);
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'delete',
      name: 'old-skill',
    }) as { status?: string; name?: string };
    expect(result.status).toBe('deleted');
    expect(result.name).toBe('old-skill');
  });

  it('create: returns error when DB throws on saveSkill', async () => {
    getSkillByNameMock.mockResolvedValue(null);
    saveSkillMock.mockRejectedValue(new Error('unique constraint violation'));
    const { skillManageTool } = await import('./skills-tools.js');
    const result = await skillManageTool.execute({
      action: 'create',
      name: 'test-skill',
      description: 'A skill',
      steps: '1. Do it.',
    }) as { error?: string };
    expect(result.error).toContain('unique constraint');
  });
});
```

---

## What NOT to change

- Do not change `src/skills/store.ts`.
- Do not change `dangerous: true`, `requiresConfirmation: true`, or `needsConfirmation` on `skillManageTool`.
- Do not change the parameter schemas for any of the three tools.
- Do not change the `limit` clamping logic in `skillsListTool`.
- Do not change the `updates` object construction logic in the `update` branch.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/skills-tools.test.ts` - all 16 tests pass (3 list + 4 view + 10 manage)
- [ ] In `skills-tools.ts`, every DB call in every execute function is wrapped in try/catch returning `{ error: string }`
- [ ] Descriptions updated for all three tools
- [ ] Regression: `npx vitest run src/tools/send-message.test.ts src/tools/text-to-speech.test.ts src/tools/cronjob.test.ts src/tools/code.test.ts src/tools/delegate-task.test.ts src/tools/browser/session.test.ts src/tools/process.test.ts src/tools/shell.test.ts src/tools/search-files.test.ts src/tools/patch.test.ts src/tools/file.test.ts` - all pass
