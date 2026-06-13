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
