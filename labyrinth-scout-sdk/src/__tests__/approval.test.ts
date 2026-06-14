import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScoutClient } from '../client.js';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

describe('approval workflow SDK', () => {
  const client = new ScoutClient({ url: 'https://scout.test', apiKey: 'test-key' });

  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waitForApproval: returns approved:true when status is approved', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'approved' }),
    });

    const promise = client.waitForApproval('approval-1', { pollIntervalMs: 100 });
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result).toEqual({ approved: true });
  });

  it('waitForApproval: returns approved:false with reason when rejected', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'rejected', rejection_reason: 'policy violation' }),
    });

    const promise = client.waitForApproval('approval-2', { pollIntervalMs: 100 });
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result).toEqual({ approved: false, reason: 'policy violation' });
  });

  it('waitForApproval: returns approved:false when expired', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'expired' }),
    });

    const promise = client.waitForApproval('approval-3', { pollIntervalMs: 100 });
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result).toEqual({ approved: false, reason: 'Approval expired' });
  });

  it('waitForApproval: enabled=false returns approved:true immediately', async () => {
    const disabled = new ScoutClient({ url: 'https://scout.test', apiKey: 'test-key', enabled: false });
    const result = await disabled.waitForApproval('approval-4');
    expect(result).toEqual({ approved: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('evaluateAndWait: returns proceed:true for allow decision', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        decision: 'allow',
        actionType: 'http',
        reason: 'ok',
        riskScore: 10,
        shieldMode: 'observe',
      }),
    });

    const result = await client.evaluateAndWait({
      session_id: 's1',
      action_type: 'http',
      content: 'hello',
    });

    expect(result.proceed).toBe(true);
    expect(result.decision.decision).toBe('allow');
  });

  it('evaluateAndWait: polls and returns proceed:false for rejected approval', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          decision: 'require_approval',
          actionType: 'email',
          reason: 'needs approval',
          riskScore: 72,
          shieldMode: 'guard',
          approval_id: 'approval-5',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'rejected', rejection_reason: 'denied by operator' }),
      });

    const promise = client.evaluateAndWait(
      { session_id: 's2', tool_name: 'email-send', action_type: 'email' },
      { waitTimeoutMs: 30_000 },
    );
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('denied by operator');
  });
});
