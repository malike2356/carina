import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./learning-ops.js', () => ({
  getLearningLoopMetrics: vi.fn().mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00.000Z',
    eventsLast24h: 2,
    correctionsLast24h: 1,
    draftsPending: 1,
    promotionsLast7d: 0,
    lastCuratorRunAt: null,
    lastPreferenceLearnedAt: '2026-01-02T00:00:00.000Z',
    preferencesLearnedTotal: 3,
    autoSkillEnabled: true,
    curatorEnabled: true,
  }),
  listAcceptedImprovements: vi.fn().mockResolvedValue([
    {
      eventId: 'e1',
      eventType: 'skill_created',
      skillName: 'deploy-staging',
      createdAt: new Date().toISOString(),
    },
  ]),
  listLearnedPreferences: vi.fn().mockResolvedValue([
    {
      eventId: 'p1',
      preference: 'Operator prefers concise replies',
      action: 'added',
      learnedAt: new Date().toISOString(),
    },
  ]),
  listPendingCorrections: vi.fn().mockResolvedValue([]),
}));

vi.mock('./learning-events.js', () => ({
  listLearningEvents: vi.fn().mockResolvedValue([
    {
      id: 'o1',
      tenantId: '__operator__',
      sessionId: 'sess-abc',
      eventType: 'task_outcome_saved',
      createdAt: new Date().toISOString(),
      inputSummary: { topic: 'Deploy staging' },
    },
  ]),
}));

vi.mock('./workshop-store.js', () => ({
  workshopReviewEnabled: vi.fn().mockReturnValue(false),
  listWorkshopDrafts: vi.fn().mockReturnValue([]),
}));

describe('learning-recap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds recap sections from recent learning activity', async () => {
    const { buildLearningRecap } = await import('./learning-recap.js');
    const recap = await buildLearningRecap('__operator__', { days: 7 });
    expect(recap.sections.some((s) => s.title === 'Skills created or refined')).toBe(true);
    expect(recap.sections.some((s) => s.title === 'Preferences learned')).toBe(true);
    expect(recap.sections.some((s) => s.title === 'Work summaries indexed')).toBe(true);
    expect(recap.hints.some((h) => h.includes('memory sessions search'))).toBe(true);
  });

  it('formats operator-readable recap text', async () => {
    const { buildLearningRecap, formatLearningRecap } = await import('./learning-recap.js');
    const recap = await buildLearningRecap('__operator__', { days: 7 });
    const text = formatLearningRecap(recap);
    expect(text).toContain('Learning recap');
    expect(text).toContain('Find prior work');
  });
});
