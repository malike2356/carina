import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('restoreSkillVersion', () => {
  it('restores a skill from a prior snapshot and records a new version', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          skill_id: 'skill-1',
          version: 2,
          steps: 'old steps',
          trigger_keywords: ['a'],
          tools_used: ['tool-a'],
          source: 'learning-loop-refine',
          learning_event_id: null,
          created_at: '2026-01-01T00:00:00Z',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ version: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ version: 5 }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    vi.doMock('../memory/db.js', () => ({
      pool: { query: queryMock },
    }));

    const { restoreSkillVersion } = await import('./skill-versions.js');
    const result = await restoreSkillVersion({
      skillId: 'skill-1',
      skillName: 'demo-skill',
      version: 2,
    });

    expect(result.restored).toBe(true);
    expect(result.fromVersion).toBe(4);
    expect(result.toVersion).toBe(5);
  });

  it('returns already_at_version when target matches current head', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          skill_id: 'skill-1',
          version: 3,
          steps: 'steps',
          trigger_keywords: [],
          tools_used: [],
          source: 'create',
          learning_event_id: null,
          created_at: '2026-01-01T00:00:00Z',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ version: 3 }], rowCount: 1 });

    vi.doMock('../memory/db.js', () => ({
      pool: { query: queryMock },
    }));

    const { restoreSkillVersion } = await import('./skill-versions.js');
    const result = await restoreSkillVersion({
      skillId: 'skill-1',
      skillName: 'demo-skill',
      version: 3,
    });

    expect(result.restored).toBe(false);
    expect(result.reason).toBe('already_at_version');
  });
});
