import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.CARINA_AUTO_SKILL;
  delete process.env.CARINA_SKILL_CURATOR_ENABLED;
});

describe('learning-ops', () => {
  it('rollbackSkillByName writes audit and learning events', async () => {
    vi.doMock('./store.js', () => ({
      getSkillByName: vi.fn().mockResolvedValue({
        id: 'skill-1',
        name: 'demo-skill',
        steps: 'current',
        trigger: [],
        toolsUsed: [],
      }),
    }));
    vi.doMock('./skill-versions.js', () => ({
      restoreSkillVersion: vi.fn().mockResolvedValue({
        restored: true,
        skillId: 'skill-1',
        skillName: 'demo-skill',
        fromVersion: 4,
        toVersion: 5,
      }),
    }));
    vi.doMock('./skill-audit-log.js', () => ({
      logSkillAction: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('./learning-events.js', () => ({
      appendLearningEvent: vi.fn().mockResolvedValue('evt-1'),
      listLearningEvents: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('./curator.js', () => ({
      getLastCuratorRunMs: vi.fn().mockResolvedValue(0),
    }));
    vi.doMock('../memory/db.js', () => ({
      pool: { query: vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 }) },
    }));

    const { rollbackSkillByName } = await import('./learning-ops.js');
    const result = await rollbackSkillByName('demo-skill', 2, { reason: 'bad refinement' });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('demo-skill');
  });

  it('listLearnedPreferences maps learning events', async () => {
    vi.doMock('./learning-events.js', () => ({
      listLearningEvents: vi.fn().mockResolvedValue([
        {
          id: 'evt-1',
          eventType: 'preference_learned',
          outputSummary: { preference: 'Operator prefers POST', confidence: 0.82 },
          createdAt: '2026-06-15T10:00:00Z',
        },
      ]),
    }));
    vi.doMock('./curator.js', () => ({
      getLastCuratorRunMs: vi.fn().mockResolvedValue(0),
    }));
    vi.doMock('../memory/db.js', () => ({
      pool: { query: vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 }) },
    }));

    const { listLearnedPreferences } = await import('./learning-ops.js');
    const rows = await listLearnedPreferences('tenant-a');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.preference).toContain('POST');
    expect(rows[0]?.action).toBe('added');
  });

  it('shouldAllowSkillRefinement blocks weak evidence overwrites', async () => {
    const { shouldAllowSkillRefinement } = await import('./learning-loop.js');
    const blocked = shouldAllowSkillRefinement({
      isCorrection: false,
      existingScore: 0.8,
      newScore: 0.5,
      usageCount: 10,
      hasIncomingSteps: true,
    });
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toBe('weak_evidence');
  });
});
