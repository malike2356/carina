import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: true,
      instanceId: 'test-001',
      apiKey: 'scout-test-key',
      url: 'http://localhost:4444',
    },
    scout: { mode: 'colocated', endpoint: '', enabled: true },
  },
}));

vi.mock('../scout-client.js', () => ({
  reportScoutSignal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../integrations/scout-findings-api.js', () => ({
  resolveScoutApiConfig: () => ({
    baseUrl: 'http://localhost:4444',
    apiKey: 'scout-test-key',
  }),
}));

const sampleEvents = [
  {
    id: 'evt-1',
    severity: 'critical',
    source: 'carina',
    event_type: 'prompt_injection_blocked',
    description: 'Injection from 203.0.113.42',
    metadata: {},
    ip_address: '203.0.113.42',
    session_id: 'sess-abc123',
    instance_id: 'test-001',
    created_at: new Date().toISOString(),
  },
  {
    id: 'evt-2',
    severity: 'warning',
    source: 'carina',
    event_type: 'tool_abuse',
    description: 'Suspicious tool chain',
    metadata: {},
    session_id: 'sess-abc123',
    instance_id: 'test-001',
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
];

describe('scout agentic layer (prompt 35)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('parseNlQueryFilters extracts IP and time window', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    const { parseNlQueryFilters } = await import('./nl-query-handler.js');
    const filters = parseNlQueryFilters(
      'Show suspicious activity from IP 203.0.113.42 in the last 24 hours',
    );
    expect(filters.ip).toBe('203.0.113.42');
    expect(filters.sinceMs).toBe(24 * 60 * 60 * 1000);
  });

  it('filterEvents matches session and IP', async () => {
    const { filterEvents } = await import('./scout-api-client.js');
    const filtered = filterEvents(sampleEvents, { ip: '203.0.113.42', sessionId: 'sess-abc123' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('evt-1');
  });

  it('adviseAutoResponse blocks emergency suspend on low-confidence injection', async () => {
    const { adviseAutoResponse } = await import('./response-advisor.js');
    const advice = adviseAutoResponse({
      eventType: 'prompt_injection_blocked',
      severity: 'warning',
      threatScore: 72,
      correlatedEventCount: 1,
      tier: 'high',
    });
    expect(advice.shouldExecute).toBe(false);
    expect(advice.autoExecuteAllowed).toBe(false);
    expect(advice.verdict).not.toBe('confirmed_threat');
  });

  it('adviseAutoResponse never auto-executes on info severity', async () => {
    const { adviseAutoResponse } = await import('./response-advisor.js');
    const advice = adviseAutoResponse({
      eventType: 'credential_exfiltration_attempt',
      severity: 'info',
      threatScore: 99,
      correlatedEventCount: 5,
      tier: 'emergency',
    });
    expect(advice.shouldExecute).toBe(false);
    expect(advice.verdict).toBe('false_positive');
  });

  it('adviseAutoResponse allows high-confidence credential threat with correlation', async () => {
    vi.stubEnv('SCOUT_SELF_MOD_AUTO_RESPONSE', 'true');
    const { adviseAutoResponse } = await import('./response-advisor.js');
    const advice = adviseAutoResponse({
      eventType: 'credential_exfiltration_attempt',
      severity: 'critical',
      threatScore: 96,
      correlatedEventCount: 3,
      tier: 'emergency',
    });
    expect(advice.verdict).toBe('confirmed_threat');
    expect(advice.shouldExecute).toBe(true);
    expect(advice.confidence).toBeGreaterThanOrEqual(95);
  });

  it('runInvestigation produces structured report', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ events: sampleEvents }),
    } as Response);

    const { runInvestigation } = await import('./investigation-engine.js');
    const report = await runInvestigation({ sessionId: 'sess-abc123', reason: 'test' });
    expect(report).not.toBeNull();
    expect(report?.sessionId).toBe('sess-abc123');
    expect(report?.verdict).toBeDefined();
    expect(report?.recommendedActions.length).toBeGreaterThan(0);
  });

  it('analyzeThreatCluster consumes correlation events', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    vi.stubEnv('SCOUT_AGENTIC_LLM', 'false');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/detections/matches')) {
        return {
          ok: true,
          json: async () => ({
            matches: [{ id: 'match-1', ruleId: 'rule-inj', matchedEvents: ['evt-1', 'evt-2'], firedAt: new Date().toISOString() }],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ events: sampleEvents }),
      } as Response;
    });

    const { analyzeThreatCluster } = await import('./ai-threat-analyst.js');
    const report = await analyzeThreatCluster({ clusterId: 'match-1' });
    expect(report).not.toBeNull();
    expect(report?.classification).toBeTruthy();
    expect(report?.mitreTactics.length).toBeGreaterThan(0);
    expect(report?.evidenceEventIds.length).toBeGreaterThan(0);
  });

  it('isScoutAgenticLayerEnabled is false in carina_only mode', async () => {
    vi.stubEnv('SCOUT_MODE', 'carina_only');
    const { isScoutAgenticLayerEnabled } = await import('./scout-agentic-guard.js');
    expect(isScoutAgenticLayerEnabled()).toBe(false);
  });

  it('isScoutAgenticApiAuthorized accepts X-Scout-Key', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    const { isScoutAgenticApiAuthorized } = await import('../../api/scout/auth.js');
    const denied = { headers: {} } as import('express').Request;
    expect(isScoutAgenticApiAuthorized(denied)).toBe(false);

    const allowed = { headers: { 'x-scout-key': 'scout-test-key' } } as import('express').Request;
    expect(isScoutAgenticApiAuthorized(allowed)).toBe(true);
  });

  it('runNlSecurityQuery returns formatted answer', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    vi.stubEnv('SCOUT_AGENTIC_LLM', 'false');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ events: sampleEvents }),
    } as Response);

    const { runNlSecurityQuery } = await import('./nl-query-handler.js');
    const result = await runNlSecurityQuery(
      'Show injection events from 203.0.113.42 in the last 24 hours',
    );
    expect(result?.eventCount).toBeGreaterThan(0);
    expect(result?.summary).toContain('Found');
  });
});
