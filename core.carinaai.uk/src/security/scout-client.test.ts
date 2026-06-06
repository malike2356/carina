import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockConfig = {
  labyrinth: {
    enabled: false,
    url: 'http://localhost:4444',
    apiKey: 'test-key',
    instanceId: 'carina-test',
    instanceName: 'Carina Test',
  },
};

vi.mock('../config/index.js', () => ({
  config: mockConfig,
}));

describe('scout-client - disabled', () => {
  beforeEach(() => {
    mockConfig.labyrinth.enabled = false;
    vi.resetModules();
  });

  it('reportEvent does not call fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { reportEvent } = await import('./scout-client.js');
    await reportEvent({
      severity: 'info',
      source: 'test',
      event_type: 'test',
      description: 'test',
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reportToolCall does not call fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { reportToolCall } = await import('./scout-client.js');
    await reportToolCall({
      toolName: 'web-search',
      params: { query: 'test' },
      resultSummary: 'results',
      durationMs: 100,
      success: true,
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reportHeartbeat does not call fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { reportHeartbeat } = await import('./scout-client.js');
    await reportHeartbeat();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('scout-client - sanitiseParams', () => {
  it('redacts OpenAI key pattern from params', async () => {
    mockConfig.labyrinth.enabled = true;
    vi.resetModules();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 201 }),
    );

    const { reportToolCall, _resetScoutWarnFlag } = await import('./scout-client.js');
    _resetScoutWarnFlag();

    await reportToolCall({
      toolName: 'shell-exec',
      params: { command: 'echo test', apiKey: 'test-placeholder-not-a-real-key' }, // gitleaks:allow
      resultSummary: 'done',
      durationMs: 50,
      success: true,
    });

    await new Promise((r) => setTimeout(r, 200));

    expect(fetchSpy).toHaveBeenCalled();
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.metadata.params.apiKey).toBe('[REDACTED]');
    expect(body.metadata.params.command).toBe('echo test');

    fetchSpy.mockRestore();
    mockConfig.labyrinth.enabled = false;
  });

  it('sanitiseParams redacts nested secrets', async () => {
    const { sanitiseParams } = await import('./scout-client.js');
    const out = sanitiseParams({
      nested: { token: 'Bearer secret-token-value' },
      safe: 'hello',
    });
    expect((out.nested as Record<string, unknown>).token).toBe('[REDACTED]');
    expect(out.safe).toBe('hello');
  });
});
