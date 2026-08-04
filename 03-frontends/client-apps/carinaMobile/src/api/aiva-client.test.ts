import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AivaApiError,
  buildAivaUrl,
  createAivaWorker,
  dismissAivaWorker,
  fetchAivaSubscriptionStatus,
  formatAivaApiError,
  getAivaWorker,
  listAivaWorkers,
  parseAivaSubscriptionStatus,
  parseAivaWorkersList,
  pauseAivaWorker,
} from './aiva-client';
import { isApiAuthError } from '@/lib/cloud-features';

describe('aiva-client URLs and headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds aiva paths against a trimmed base URL', () => {
    expect(buildAivaUrl('https://app.carinaai.uk/', '/api/aiva/workers')).toBe(
      'https://app.carinaai.uk/api/aiva/workers',
    );
  });

  it('injects bearer auth when listing workers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ workers: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await listAivaWorkers('https://app.carinaai.uk/', {
      apiKey: 'sess-token',
      deviceToken: 'cdv_test',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/aiva/workers',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sess-token',
          'X-Device-Token': 'cdv_test',
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('loads a single worker and subscription status', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            worker: {
              id: 'w1',
              name: 'Alex',
              roleDescription: 'Inbox',
              status: 'active',
              channels: ['email'],
              workspaceId: 'ws1',
              language: 'en-GB',
              messagesToday: 4,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            planTier: 'starter',
            status: 'active',
            slotLimit: 3,
            aivasUsed: 1,
            canHireMore: true,
            trialEndsAt: null,
            trialDaysRemaining: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const worker = await getAivaWorker('https://app.carinaai.uk', 'w1', { apiKey: 't' });
    expect(worker.name).toBe('Alex');
    expect(worker.messagesToday).toBe(4);

    const status = await fetchAivaSubscriptionStatus('https://app.carinaai.uk', { apiKey: 't' });
    expect(status.planTier).toBe('starter');
    expect(status.aivasUsed).toBe(1);
  });
});

describe('aiva-client parsers', () => {
  it('parses worker list envelopes and drops invalid rows', () => {
    const workers = parseAivaWorkersList({
      workers: [
        {
          id: 'w1',
          name: 'Sam',
          role_description: 'Support',
          status: 'paused',
          channels: ['telegram'],
          workspace_id: 'ws',
        },
        { name: 'missing-id' },
      ],
    });
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatchObject({
      id: 'w1',
      name: 'Sam',
      roleDescription: 'Support',
      status: 'paused',
      channels: ['telegram'],
    });
  });

  it('parses subscription status with safe defaults', () => {
    const status = parseAivaSubscriptionStatus({
      planTier: 'growth',
      aivasUsed: 2,
      canHireMore: false,
    });
    expect(status.planTier).toBe('growth');
    expect(status.status).toBe('unknown');
    expect(status.slotLimit).toBe(0);
    expect(status.canHireMore).toBe(false);
  });
});

describe('aiva-client error envelopes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes JSON error bodies and preserves status', () => {
    const err = formatAivaApiError(
      'Aiva workers',
      403,
      JSON.stringify({ error: 'Trial expired', code: 'trial_ended' }),
      'Forbidden',
    );
    expect(err).toBeInstanceOf(AivaApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('trial_ended');
    expect(err.message).toContain('Trial expired');
    expect(err.isForbidden).toBe(true);
  });

  it('maps 401 responses to session-expired detection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not signed in' }), {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    try {
      await listAivaWorkers('https://app.carinaai.uk', { apiKey: 'bad' });
      throw new Error('expected listAivaWorkers to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(AivaApiError);
      const apiErr = err as AivaApiError;
      expect(apiErr.isUnauthorized).toBe(true);
      expect(apiErr.status).toBe(401);
      expect(isApiAuthError(apiErr.message)).toBe(true);
    }
  });

  it('creates a worker with POST body and auth headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          worker: {
            id: 'w-new',
            name: 'Front desk',
            roleDescription: 'Answer visitors',
            status: 'active',
            channels: ['email'],
            workspaceId: 'ws1',
            language: 'en-GB',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const worker = await createAivaWorker(
      'https://app.carinaai.uk',
      {
        roleName: 'Front desk',
        roleDescription: 'Answer visitors',
        channels: ['email'],
      },
      { apiKey: 'sess' },
    );

    expect(worker.id).toBe('w-new');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/aiva/workers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sess' }),
      }),
    );
  });

  it('pauses a worker via PATCH status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          worker: {
            id: 'w1',
            name: 'Alex',
            roleDescription: 'Inbox',
            status: 'paused',
            channels: [],
            workspaceId: 'ws1',
            language: 'en-GB',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const worker = await pauseAivaWorker('https://app.carinaai.uk', 'w1', { apiKey: 't' });
    expect(worker.status).toBe('paused');
  });

  it('dismisses a worker via DELETE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      dismissAivaWorker('https://app.carinaai.uk', 'w1', { apiKey: 't' }),
    ).resolves.toEqual({ ok: true });
  });
});
