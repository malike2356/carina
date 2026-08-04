import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoutClient } from '../client.js';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

describe('ScoutClient', () => {
  const client = new ScoutClient({ url: 'https://scout.test', apiKey: 'test-key' });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('emit: POST /api/events with correct headers and body', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const event = {
      severity: 'info' as const,
      source: 'agent-1',
      event_type: 'tool_call',
      description: 'test',
    };
    await client.emit(event);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://scout.test/api/events',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Scout-Key': 'test-key' },
        body: JSON.stringify(event),
      }),
    );
  });

  it('heartbeat: POST /api/heartbeat with instance_id and name', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await client.heartbeat('inst-1', 'My Agent');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://scout.test/api/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ instance_id: 'inst-1', name: 'My Agent' }),
      }),
    );
  });

  it('register: POST /api/instances/register returns instance_id', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ instance_id: 'openai-abc12345' }),
    });
    const result = await client.register('Support Bot', 'openai');
    expect(result).toEqual({ instance_id: 'openai-abc12345' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://scout.test/api/instances/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Support Bot', agent_type: 'openai' }),
      }),
    );
  });

  it('instanceStatus: GET /api/instances/:id/status returns suspended=false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suspended: false }),
    });
    const result = await client.instanceStatus('inst-1');
    expect(result).toEqual({ suspended: false });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://scout.test/api/instances/inst-1/status',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', 'X-Scout-Key': 'test-key' },
      }),
    );
  });

  it('policyEvaluate: POST /api/policy/evaluate with tool_name returns decision', async () => {
    const decision = {
      decision: 'allow',
      actionType: 'http',
      reason: 'ok',
      riskScore: 0,
      shieldMode: 'observe',
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => decision });
    const result = await client.policyEvaluate({
      session_id: 'sess-1',
      tool_name: 'search',
      content: 'hello',
    });
    expect(result).toEqual(decision);
  });

  it('policyEvaluate: throws when Scout returns non-ok status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    });
    await expect(
      client.policyEvaluate({ session_id: 'sess-1', content: 'bad' }),
    ).rejects.toThrow('Scout /api/policy/evaluate 403');
  });

  it('policyContext: POST /api/policy/context with content and session_id', async () => {
    const result = { action: 'pass', content: 'hello', reason: 'clean' };
    mockFetch.mockResolvedValue({ ok: true, json: async () => result });
    const response = await client.policyContext('hello', 'sess-1', { contextType: 'user_prompt' });
    expect(response).toEqual(result);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://scout.test/api/policy/context',
      expect.objectContaining({
        body: JSON.stringify({
          content: 'hello',
          session_id: 'sess-1',
          context_type: 'user_prompt',
          tool_name: undefined,
        }),
      }),
    );
  });

  it('killSwitchStatus: GET /api/killswitch/status returns armed=true', async () => {
    const status = {
      armed: true,
      triggered: false,
      triggered_by: null,
      reason: null,
      agents_active: 3,
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => status });
    const result = await client.killSwitchStatus();
    expect(result).toEqual(status);
  });
});

describe('ScoutClient v0.1 compatibility', () => {
  const bound = new ScoutClient({
    url: 'https://scout.test',
    apiKey: 'test-key',
    instanceId: 'agent-1',
    agentType: 'langchain',
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('report: maps camelCase fields to emit payload with bound instanceId', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await bound.report({ severity: 'warning', eventType: 'policy_blocked', description: 'blocked' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.event_type).toBe('policy_blocked');
    expect(body.severity).toBe('warning');
    expect(body.instance_id).toBe('agent-1');
    expect(body.source).toBe('langchain');
  });

  it('reportToolCall: emits tool_call event with tool metadata', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await bound.reportToolCall({ toolName: 'send_email', params: { to: 'a@b.com' }, durationMs: 120 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.event_type).toBe('tool_call');
    expect((body.metadata as Record<string, unknown>).toolName).toBe('send_email');
  });

  it('checkStatus: returns suspended=false when Scout returns 404 (unknown instance)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
    const status = await bound.checkStatus();
    expect(status).toEqual({ suspended: false });
  });

  it('startKillSwitchPolling: calls onSuspend when instance becomes suspended', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ suspended: true, reason: 'manual kill' }) });
    const onSuspend = vi.fn();
    const stop = bound.startKillSwitchPolling(onSuspend, 50);
    await new Promise((r) => setTimeout(r, 80));
    stop();
    expect(onSuspend).toHaveBeenCalledWith('manual kill');
  });

  it('enabled=false: report and checkStatus are no-ops', async () => {
    const disabled = new ScoutClient({ url: 'https://scout.test', apiKey: 'k', instanceId: 'x', enabled: false });
    await disabled.report({ severity: 'info', eventType: 'test', description: 'test' });
    expect(mockFetch).not.toHaveBeenCalled();
    const status = await disabled.checkStatus();
    expect(status).toEqual({ suspended: false });
  });
});
