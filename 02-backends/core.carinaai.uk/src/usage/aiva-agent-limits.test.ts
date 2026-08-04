import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('../admin/admin-audit.js', () => ({
  writeAdminAudit: vi.fn(async () => undefined),
}));

async function loadLimits() {
  vi.resetModules();
  return import('./aiva-agent-limits.js');
}

function mockSchema() {
  // policies, counters, index
  for (let i = 0; i < 3; i++) {
    query.mockResolvedValueOnce({ rows: [] });
  }
}

describe('aiva-agent-limits', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('estimates tokens conservatively from characters', async () => {
    const { estimateTokensFromText } = await loadLimits();
    expect(estimateTokensFromText('abcd')).toBe(1);
    expect(estimateTokensFromText('abcdefgh')).toBe(2);
    expect(estimateTokensFromText({ a: 1 })).toBeGreaterThan(0);
  });

  it('normalizes day/month policies and rejects bad periods', async () => {
    const { normalizeLimits } = await loadLimits();
    expect(normalizeLimits({ period: 'day', maxCalls: 10 })).toEqual({
      period: 'day',
      maxCalls: 10,
    });
    expect(() => normalizeLimits({ period: 'week', maxCalls: 1 })).toThrow(/period/);
    expect(normalizeLimits({ period: 'month' })).toBeNull();
  });

  it('allows calls below threshold', async () => {
    const { evaluateLimits } = await loadLimits();
    const result = evaluateLimits(
      { period: 'day', maxCalls: 5, maxTokens: 1000 },
      { calls: 2, tokens: 100, perService: {} },
      { tokens: 50, actorId: 'workspace:ws-1' },
    );
    expect(result.allowed).toBe(true);
    expect(result.remainingCalls).toBe(3);
  });

  it('rejects calls at threshold', async () => {
    const { evaluateLimits } = await loadLimits();
    const result = evaluateLimits(
      { period: 'day', maxCalls: 2 },
      { calls: 2, tokens: 0, perService: {} },
      { tokens: 0, actorId: 'workspace:ws-1' },
    );
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(429);
    expect(result.code).toBe('AGENT_LIMIT_EXCEEDED');
    expect(result.metric).toBe('calls');
  });

  it('per-service limit blocks only that service', async () => {
    const { evaluateLimits } = await loadLimits();
    const limits = {
      period: 'month' as const,
      perService: { gmail: { maxCalls: 1 } },
    };
    const usage = {
      calls: 10,
      tokens: 0,
      perService: { gmail: { calls: 1, tokens: 0 } },
    };
    const blocked = evaluateLimits(limits, usage, {
      service: 'gmail',
      actorId: 'token:a',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.scope).toBe('gmail');

    const other = evaluateLimits(limits, usage, {
      service: 'inference',
      actorId: 'token:a',
    });
    expect(other.allowed).toBe(true);
  });

  it('daily and monthly windows use distinct period starts', async () => {
    const { periodStartDay } = await loadLimits();
    const now = new Date('2026-07-11T15:00:00.000Z');
    expect(periodStartDay('day', now)).toBe('2026-07-11');
    expect(periodStartDay('month', now)).toBe('2026-07-01');
  });

  it('isolates API token actors so token A cannot consume token B', async () => {
    mockSchema();
    // getActorLimits for token A -> custom maxCalls 1
    query.mockResolvedValueOnce({
      rows: [{ limits_json: { period: 'day', maxCalls: 1 } }],
    });
    // getActorUsage for token A
    query.mockResolvedValueOnce({
      rows: [{ service: 'inference', calls: '1', tokens: '10' }],
    });

    const { checkActorLimits, buildActorId } = await loadLimits();
    const tokenA = buildActorId('token', 'tok-a');
    const tokenB = buildActorId('token', 'tok-b');
    const denied = await checkActorLimits('ws-1', tokenA, {
      service: 'inference',
      tokens: 1,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.actorId).toBe(tokenA);

    mockSchema();
    query.mockResolvedValueOnce({ rows: [] }); // no custom for B
    const allowed = await checkActorLimits('ws-1', tokenB, {
      service: 'inference',
      tokens: 1,
      fallbackPolicy: null,
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.actorId).toBe(tokenB);
  });

  it('channel abuse still hits workspace tenant defaults', async () => {
    mockSchema();
    // workspace custom null -> fallback trial
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({
      rows: [{ service: 'inference', calls: '40', tokens: '1000' }],
    });

    const { checkAivaRequestLimits, TRIAL_DEFAULT_LIMITS } = await loadLimits();
    expect(TRIAL_DEFAULT_LIMITS.maxCalls).toBe(40);
    const result = await checkAivaRequestLimits({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      service: 'inference',
      estimatedTokens: 10,
      planTier: 'trial',
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('AGENT_LIMIT_EXCEEDED');
  });

  it('trial defaults are stricter than starter', async () => {
    const { defaultLimitsForPlan } = await loadLimits();
    const trial = defaultLimitsForPlan('trial');
    const starter = defaultLimitsForPlan('starter');
    expect(trial.period).toBe('day');
    expect(starter.period).toBe('month');
    expect((trial.maxCalls ?? 0)).toBeLessThan(starter.maxCalls ?? 0);
  });
});
