import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { n8nTool } from './n8n.js';

const exec = (params: Record<string, unknown>) => n8nTool.execute(params);

const mockFetch = (status: number, body: unknown, ok?: boolean) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: ok ?? status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
};

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.N8N_BASE_URL = 'https://n8n.example.com';
  process.env.N8N_API_KEY = 'test-api-key';
});

afterEach(() => {
  delete process.env.N8N_BASE_URL;
  delete process.env.N8N_API_KEY;
});

describe('n8n tool - trigger', () => {
  it('triggers a workflow by ID via /run endpoint', async () => {
    mockFetch(200, { executionId: 'abc123', status: 'running' });
    const result = await exec({ action: 'trigger', workflow_id: '42' });
    expect(result).toMatchObject({ triggered: true, execution_id: 'abc123', status: 'running' });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/api/v1/workflows/42/run');
    expect(call[1].headers['X-N8N-API-KEY']).toBe('test-api-key');
  });

  it('triggers a webhook path directly', async () => {
    mockFetch(200, { executionId: 'wh999' });
    await exec({ action: 'trigger', workflow_id: 'my-webhook/path' });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/webhook/my-webhook/path');
  });

  it('returns error when N8N_BASE_URL not set', async () => {
    delete process.env.N8N_BASE_URL;
    const result = await exec({ action: 'trigger', workflow_id: '1' });
    expect(result).toMatchObject({ error: expect.stringContaining('N8N_BASE_URL') });
  });

  it('returns error when workflow_id not provided', async () => {
    const result = await exec({ action: 'trigger' });
    expect(result).toMatchObject({ error: expect.stringContaining('workflow_id') });
  });

  it('returns error on 404', async () => {
    mockFetch(404, { message: 'not found' }, false);
    const result = await exec({ action: 'trigger', workflow_id: '99' });
    expect(result).toMatchObject({ error: expect.stringContaining('not found') });
  });

  it('accepts inline base_url and api_key overrides', async () => {
    mockFetch(200, { executionId: 'x1' });
    await exec({
      action: 'trigger',
      workflow_id: '1',
      base_url: 'https://other.n8n.io',
      api_key: 'override-key',
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('other.n8n.io');
    expect(call[1].headers['X-N8N-API-KEY']).toBe('override-key');
  });
});

describe('n8n tool - status', () => {
  it('returns execution status', async () => {
    mockFetch(200, {
      id: 'abc123',
      status: 'success',
      finished: true,
      startedAt: '2025-01-01T00:00:00Z',
      stoppedAt: '2025-01-01T00:00:05Z',
    });
    const result = await exec({ action: 'status', execution_id: 'abc123' }) as Record<string, unknown>;
    expect(result.status).toBe('success');
    expect(result.finished).toBe(true);
    expect(typeof result.duration_ms).toBe('number');
  });

  it('returns error when execution_id not provided', async () => {
    const result = await exec({ action: 'status' });
    expect(result).toMatchObject({ error: expect.stringContaining('execution_id') });
  });

  it('returns error on 404', async () => {
    mockFetch(404, {}, false);
    const result = await exec({ action: 'status', execution_id: 'missing' });
    expect(result).toMatchObject({ error: expect.stringContaining('missing') });
  });
});

describe('n8n tool - list', () => {
  it('returns workflow list', async () => {
    mockFetch(200, { data: [{ id: '1', name: 'Portfolio Report', active: true, updatedAt: '2025-01-01' }] });
    const result = await exec({ action: 'list' }) as Record<string, unknown>;
    expect(Array.isArray(result.workflows)).toBe(true);
    expect((result.workflows as unknown[])[0]).toMatchObject({
      id: '1',
      name: 'Portfolio Report',
      active: true,
    });
  });

  it('returns error when N8N_BASE_URL not set', async () => {
    delete process.env.N8N_BASE_URL;
    const result = await exec({ action: 'list' });
    expect(result).toMatchObject({ error: expect.stringContaining('N8N_BASE_URL') });
  });
});

describe('n8n tool - meta', () => {
  it('needsConfirmation returns true for trigger, false for others', () => {
    expect(n8nTool.needsConfirmation?.({ action: 'trigger' })).toBe(true);
    expect(n8nTool.needsConfirmation?.({ action: 'status' })).toBe(false);
    expect(n8nTool.needsConfirmation?.({ action: 'list' })).toBe(false);
  });
});
