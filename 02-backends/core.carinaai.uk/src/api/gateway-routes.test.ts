import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { AddressInfo } from 'net';

// Mocks must be declared before any module imports that depend on them
const resolvePartnerApiKey = vi.fn();
const getPartnerAccount = vi.fn();
const emitPlatformEvent = vi.fn();
const getRedis = vi.fn();
const listAvailablePacks = vi.fn();
const routerChat = vi.fn();
const poolQuery = vi.fn();

vi.mock('../hosted/partner-api-key-service.js', () => ({ resolvePartnerApiKey }));
vi.mock('../hosted/partner-service.js', () => ({ getPartnerAccount, getPartnerIdForOrg: vi.fn() }));
vi.mock('../billing/platform-event-emitter.js', () => ({ emitPlatformEvent }));
vi.mock('../memory/redis.js', () => ({ getRedis }));
vi.mock('../memory/db.js', () => ({ pool: { query: poolQuery } }));
vi.mock('../skills/index.js', () => ({ listAvailablePacks }));
vi.mock('../brain/llm.js', () => {
  function LLMRouter() {
    return { chat: routerChat, setTenant: vi.fn() };
  }
  return { LLMRouter };
});

async function buildApp() {
  const { gatewayRouter } = await import('./gateway-routes.js');
  const app = express();
  app.use(gatewayRouter);
  return app;
}

async function startServer(app: express.Express) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return { server, base };
}

describe('platform gateway routes', () => {
  let app: express.Express;
  let base: string;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    vi.resetAllMocks();
    emitPlatformEvent.mockResolvedValue(undefined);
    getRedis.mockReturnValue(null);
    poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    app = await buildApp();
    ({ server, base } = await startServer(app));
  });

  afterEach(() => {
    server.close();
  });

  describe('GET /api/v1/platform/health', () => {
    it('returns 200 with status ok (no auth required)', async () => {
      const res = await fetch(`${base}/api/v1/platform/health`);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.status).toBe('ok');
    });
  });

  describe('GET /api/v1/platform/info', () => {
    it('returns API info without auth', async () => {
      const res = await fetch(`${base}/api/v1/platform/info`);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.api).toBe('Carina Platform API');
      expect(Array.isArray(body.scopes)).toBe(true);
    });
  });

  describe('POST /api/v1/platform/message', () => {
    it('returns 401 without bearer token', async () => {
      const res = await fetch(`${base}/api/v1/platform/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('missing_bearer_token');
    });

    it('returns 401 with invalid key', async () => {
      resolvePartnerApiKey.mockResolvedValue(null);
      const res = await fetch(`${base}/api/v1/platform/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cpk_test_invalid',
        },
        body: JSON.stringify({ message: 'hello' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns reply and emits platform_event with valid key', async () => {
      resolvePartnerApiKey.mockResolvedValue({
        id: 'key-1', partnerId: 'partner-1', scopes: ['session', 'memory'],
        rateLimitRpm: 60, revenueShareBps: 50, status: 'active',
        label: 'Test', keyPrefix: 'cpk_test_', monthlyCapEvents: 100000, createdAt: '2026-01-01', lastUsedAt: null,
      });
      getPartnerAccount.mockResolvedValue({ id: 'partner-1', name: 'Acme', status: 'active', slug: 'acme', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
      routerChat.mockResolvedValue({ content: 'Hello!', tokensIn: 10, tokensOut: 5, model: 'deepseek-chat', provider: 'deepseek' });

      const res = await fetch(`${base}/api/v1/platform/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cpk_test_valid',
        },
        body: JSON.stringify({ message: 'hello world' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.reply).toBe('Hello!');
      expect(body.tokensIn).toBe(10);
      expect(emitPlatformEvent).toHaveBeenCalled();
    });
  });

  describe('requireScope', () => {
    it('returns 403 when key lacks required scope', async () => {
      resolvePartnerApiKey.mockResolvedValue({
        id: 'key-2', partnerId: 'partner-2', scopes: ['session'],
        rateLimitRpm: 60, revenueShareBps: 50, status: 'active',
        label: 'Limited', keyPrefix: 'cpk_test_', monthlyCapEvents: 100000, createdAt: '2026-01-01', lastUsedAt: null,
      });
      getPartnerAccount.mockResolvedValue({ id: 'partner-2', name: 'Ltd', status: 'active', slug: 'ltd', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });

      const res = await fetch(`${base}/api/v1/platform/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cpk_test_session_only',
        },
        body: JSON.stringify({ workspaceId: 'ws-1', key: 'k', value: 'v' }),
      });
      expect(res.status).toBe(403);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('insufficient_scope');
      expect(body.required).toBe('memory');
    });
  });

  describe('GET /api/v1/platform/usage', () => {
    function analyticsKey() {
      return {
        id: 'key-3', partnerId: 'partner-3', scopes: ['analytics'],
        rateLimitRpm: 60, revenueShareBps: 50, status: 'active',
        label: 'Analytics', keyPrefix: 'cpk_test_', monthlyCapEvents: 100000, createdAt: '2026-01-01', lastUsedAt: null,
      };
    }
    function analyticsPartner() {
      return { id: 'partner-3', name: 'Metrics Co', status: 'active', slug: 'metrics', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
    }

    it('returns 400 when from/to are missing', async () => {
      resolvePartnerApiKey.mockResolvedValue(analyticsKey());
      getPartnerAccount.mockResolvedValue(analyticsPartner());
      const res = await fetch(
        `${base}/api/v1/platform/usage`,
        { headers: { Authorization: 'Bearer cpk_test_analytics' } },
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when date range exceeds 90 days', async () => {
      resolvePartnerApiKey.mockResolvedValue(analyticsKey());
      getPartnerAccount.mockResolvedValue(analyticsPartner());
      const res = await fetch(
        `${base}/api/v1/platform/usage?from=2026-01-01&to=2026-06-30`,
        { headers: { Authorization: 'Bearer cpk_test_analytics' } },
      );
      expect(res.status).toBe(400);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('date_range_too_large');
    });

    it('returns aggregated usage for groupBy=day', async () => {
      resolvePartnerApiKey.mockResolvedValue(analyticsKey());
      getPartnerAccount.mockResolvedValue(analyticsPartner());
      poolQuery.mockResolvedValueOnce({
        rows: [
          { day: new Date('2026-06-01'), events: '10', tokens_in: '1000', tokens_out: '200', tool_calls: '2', skill_calls: '0' },
          { day: new Date('2026-06-02'), events: '5',  tokens_in: '500',  tokens_out: '100', tool_calls: '1', skill_calls: '0' },
        ],
        rowCount: 2,
      });

      const res = await fetch(
        `${base}/api/v1/platform/usage?from=2026-06-01&to=2026-06-30&groupBy=day`,
        { headers: { Authorization: 'Bearer cpk_test_analytics' } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect((body.totals as Record<string, number>).events).toBe(15);
      expect(Array.isArray(body.series)).toBe(true);
      expect((body.series as unknown[]).length).toBe(2);
    });

    it('rejects orgId that does not belong to the partner', async () => {
      resolvePartnerApiKey.mockResolvedValue(analyticsKey());
      getPartnerAccount.mockResolvedValue(analyticsPartner());
      // org check returns empty
      poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await fetch(
        `${base}/api/v1/platform/usage?from=2026-06-01&to=2026-06-30&orgId=other-org`,
        { headers: { Authorization: 'Bearer cpk_test_analytics' } },
      );
      expect(res.status).toBe(403);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('org_not_found');
    });
  });

  describe('GET /api/v1/platform/trends', () => {
    it('returns partner and platform stats with interpretation', async () => {
      resolvePartnerApiKey.mockResolvedValue({
        id: 'key-t', partnerId: 'partner-t', scopes: ['analytics'],
        rateLimitRpm: 60, revenueShareBps: 50, status: 'active',
        label: 'Trends', keyPrefix: 'cpk_test_', monthlyCapEvents: 100000, createdAt: '2026-01-01', lastUsedAt: null,
      });
      getPartnerAccount.mockResolvedValue({ id: 'partner-t', name: 'T Co', status: 'active', slug: 't', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
      poolQuery.mockResolvedValueOnce({ rows: [{ avg_daily_events: '400', avg_daily_tokens_in: '100000' }], rowCount: 1 });
      poolQuery.mockResolvedValueOnce({ rows: [{ median_daily_events: '200', median_daily_tokens_in: '60000' }], rowCount: 1 });

      const res = await fetch(
        `${base}/api/v1/platform/trends?from=2026-06-01&to=2026-06-30`,
        { headers: { Authorization: 'Bearer cpk_test_trends' } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect((body.partner as Record<string, number>).avgDailyEvents).toBe(400);
      expect((body.platform as Record<string, number>).medianDailyEvents).toBe(200);
      expect(body.interpretation).toBe('Your usage is above the platform median.');
    });
  });

  describe('GET /api/v1/platform/export', () => {
    function exportKey() {
      return {
        id: 'key-e', partnerId: 'partner-e', scopes: ['analytics'],
        rateLimitRpm: 60, revenueShareBps: 50, status: 'active',
        label: 'Export', keyPrefix: 'cpk_test_', monthlyCapEvents: 100000, createdAt: '2026-01-01', lastUsedAt: null,
      };
    }

    it('returns 400 when date range exceeds 31 days', async () => {
      resolvePartnerApiKey.mockResolvedValue(exportKey());
      getPartnerAccount.mockResolvedValue({ id: 'partner-e', name: 'E Co', status: 'active', slug: 'e', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
      const res = await fetch(
        `${base}/api/v1/platform/export?from=2026-05-01&to=2026-06-30`,
        { headers: { Authorization: 'Bearer cpk_test_export' } },
      );
      expect(res.status).toBe(400);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('date_range_too_large');
    });

    it('returns CSV with correct headers for format=csv', async () => {
      resolvePartnerApiKey.mockResolvedValue(exportKey());
      getPartnerAccount.mockResolvedValue({ id: 'partner-e', name: 'E Co', status: 'active', slug: 'e', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
      poolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1', event_type: 'message', org_id: 'org-1', model: 'deepseek-chat',
          provider: 'deepseek', tokens_in: 100, tokens_out: 50, tool_calls: 0, skill_calls: 0,
          scout_verified: false, fee_pence: 0, created_at: new Date('2026-06-15'),
        }],
        rowCount: 1,
      });

      const res = await fetch(
        `${base}/api/v1/platform/export?from=2026-06-01&to=2026-06-30&format=csv`,
        { headers: { Authorization: 'Bearer cpk_test_export2' } },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toContain('.csv');
      const text = await res.text();
      expect(text).toContain('id,event_type,org_id');
      expect(text).toContain('evt-1');
      expect(text).not.toContain('metadata');
    });

    it('returns NDJSON for format=json', async () => {
      resolvePartnerApiKey.mockResolvedValue(exportKey());
      getPartnerAccount.mockResolvedValue({ id: 'partner-e', name: 'E Co', status: 'active', slug: 'e', brand: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
      poolQuery.mockResolvedValueOnce({
        rows: [{ id: 'evt-2', event_type: 'tool_call', org_id: null, model: null, provider: null, tokens_in: 0, tokens_out: 0, tool_calls: 1, skill_calls: 0, scout_verified: false, fee_pence: 0, created_at: new Date() }],
        rowCount: 1,
      });

      const res = await fetch(
        `${base}/api/v1/platform/export?from=2026-06-01&to=2026-06-30&format=json`,
        { headers: { Authorization: 'Bearer cpk_test_export3' } },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('ndjson');
      const text = await res.text();
      const parsed = JSON.parse(text.trim().split('\n')[0]) as Record<string, unknown>;
      expect(parsed.id).toBe('evt-2');
    });
  });

  describe('response headers', () => {
    it('sets X-Request-Id on every response', async () => {
      const res = await fetch(`${base}/api/v1/platform/health`);
      expect(res.headers.get('X-Request-Id')).toBeTruthy();
    });
  });
});
