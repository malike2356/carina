import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const worker = {
  id: '00000000-0000-4000-8000-000000000001',
  workspaceId: '00000000-0000-4000-8000-000000000099',
  name: 'Aria',
  roleDescription: 'Customer support',
  status: 'active' as const,
  workerConfig: {},
};

vi.mock('../workers/worker-store.js', () => ({
  getWorkerById: vi.fn(async () => worker),
}));

vi.mock('../workers/concierge-profile.js', () => ({
  getConciergeProfile: vi.fn(async () => null),
  getPublishedConciergeProfile: vi.fn(async () => null),
}));

vi.mock('../workspace/workspace-router.js', () => ({
  getWorkspaceBranding: vi.fn(async () => ({
    companyName: 'Acme',
    primaryColor: '#1a5f7a',
    logoUrl: null,
    hideVerloxAttribution: false,
  })),
}));

vi.mock('../usage/usage-service.js', () => ({
  checkAndEnforceLimit: vi.fn(async () => ({ allowed: true })),
  incrementMessageCount: vi.fn(async () => undefined),
  maybeSendUsageAlerts: vi.fn(async () => undefined),
}));

vi.mock('../customer-concierge/audience-rate-limit.js', () => ({
  consumeAudienceRateBucket: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: new Date().toISOString(),
  })),
  assertFreshEmbedNonce: vi.fn(async () => true),
}));

vi.mock('../customer-concierge/audience-session.js', async () => {
  const actual = await vi.importActual<typeof import('../customer-concierge/audience-session.js')>(
    '../customer-concierge/audience-session.js',
  );
  return {
    ...actual,
    upsertAudienceIdentity: vi.fn(async () => ({
      id: 'ident-1',
      workspaceId: worker.workspaceId,
      channel: 'web',
      externalKey: 'widget:visitor-1',
      displayName: null,
      email: null,
      phone: null,
      crmContactId: null,
    })),
    createAudienceSession: vi.fn(async () => ({
      id: 'aud-1',
      workspaceId: worker.workspaceId,
      workerId: worker.id,
      conciergeProfileId: null,
      identityId: 'ident-1',
      channel: 'web',
      sessionMode: 'public' as const,
      widgetSessionToken: 'session-token-abc',
      origin: null,
      locale: null,
      consentState: 'unknown' as const,
      riskState: 'normal' as const,
      status: 'active' as const,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })),
    getAudienceSessionByWidgetToken: vi.fn(async () => ({
      id: 'aud-1',
      workspaceId: worker.workspaceId,
      workerId: worker.id,
      conciergeProfileId: null,
      identityId: 'ident-1',
      channel: 'web',
      sessionMode: 'public' as const,
      widgetSessionToken: 'session-token-abc',
      origin: null,
      locale: null,
      consentState: 'unknown' as const,
      riskState: 'normal' as const,
      status: 'active' as const,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })),
    touchAudienceSession: vi.fn(async () => undefined),
  };
});

vi.mock('../channel-shield/intercept.js', () => ({
  maybeInterceptInbound: vi.fn(async () => ({ intercepted: false, allowLive: true })),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM widget_sessions')) {
        return {
          rows: [{
            contact_id: 'visitor-1',
            audience_session_id: 'aud-1',
            session_mode: 'public',
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          }],
        };
      }
      if (sql.includes('UPDATE widget_sessions')) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
  },
}));

async function* mockStream() {
  yield { type: 'token' as const, content: 'Hello ' };
  yield { type: 'token' as const, content: 'there.' };
  yield { type: 'done' as const };
}

vi.mock('../workers/aiva-process-message.js', () => ({
  processAivaMessageStream: vi.fn(() => mockStream()),
}));

describe('widget message SSE', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    }
  });

  it('streams LLM tokens from processAivaMessageStream as SSE events', async () => {
    const { widgetRouter } = await import('./widget-router.js');
    const app = express();
    app.use(express.json());
    app.use('/api/widget', widgetRouter);

    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await fetch(`http://127.0.0.1:${port}/api/widget/${worker.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: 'session-token-abc',
        message: 'Hi',
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const body = await res.text();
    expect(body).toContain('"type":"token"');
    expect(body).toContain('"content":"Hello "');
    expect(body).toContain('"content":"there."');
    expect(body).toContain('"type":"done"');

    const { processAivaMessageStream } = await import('../workers/aiva-process-message.js');
    expect(processAivaMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      workerId: worker.id,
      channel: 'web',
      userMessage: 'Hi',
      contactId: 'visitor-1',
      audiencePrincipal: true,
      isWebPreviewSession: false,
    }));
  });
});
