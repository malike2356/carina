import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import { learningApiRouter } from './learning-api.js';

vi.mock('../skills/learning-recap.js', () => ({
  buildLearningRecap: vi.fn().mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00.000Z',
    days: 7,
    metrics: { autoSkillEnabled: true },
    sections: [],
    hints: ['carina memory sessions search "<topic>"'],
  }),
}));

vi.mock('../skills/learning-ops.js', () => ({
  getLearningLoopMetrics: vi.fn().mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00.000Z',
    eventsLast24h: 1,
    correctionsLast24h: 0,
    draftsPending: 0,
    promotionsLast7d: 0,
    lastCuratorRunAt: null,
    lastPreferenceLearnedAt: null,
    preferencesLearnedTotal: 0,
    autoSkillEnabled: true,
    curatorEnabled: true,
  }),
  listAcceptedImprovements: vi.fn().mockResolvedValue([]),
  listLearnedPreferences: vi.fn().mockResolvedValue([]),
}));

async function getJson(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use('/api/learning', learningApiRouter);
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.json() as Record<string, unknown>;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return { status: res.status, body };
}

describe('learning-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns learning status payload', async () => {
    const { status, body } = await getJson('/api/learning/status');
    expect(status).toBe(200);
    expect(body.autoSkillEnabled).toBe(true);
    expect(body.taskOutcomesEnabled).toBe(true);
  });

  it('returns recap payload', async () => {
    const { status, body } = await getJson('/api/learning/recap?days=7');
    expect(status).toBe(200);
    expect(body.days).toBe(7);
    expect(Array.isArray(body.hints)).toBe(true);
  });
});
