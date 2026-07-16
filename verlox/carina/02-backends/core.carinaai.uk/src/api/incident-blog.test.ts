import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeMock = vi.fn();
const confirmSubscriberMock = vi.fn();
const unsubscribeMock = vi.fn();
const sendSubscribeConfirmationEmailMock = vi.fn();
const getLastResearchRunMock = vi.fn();
const listResearchRunsMock = vi.fn();

vi.mock('../blog/store.js', () => ({
  approveIncident: vi.fn(),
  createIncident: vi.fn(),
  confirmSubscriber: (...args: unknown[]) => confirmSubscriberMock(...args),
  deleteIncident: vi.fn(),
  countIncidents: vi.fn(),
  getIncident: vi.fn(),
  getIncidentStatusStats: vi.fn(),
  getLastResearchRun: (...args: unknown[]) => getLastResearchRunMock(...args),
  listResearchRuns: (...args: unknown[]) => listResearchRunsMock(...args),
  listIncidents: vi.fn(),
  listSubscribers: vi.fn(),
  subscribe: (...args: unknown[]) => subscribeMock(...args),
  unsubscribe: (...args: unknown[]) => unsubscribeMock(...args),
  publishIncident: vi.fn(),
  rejectIncident: vi.fn(),
  rejectAllDrafts: vi.fn(),
  updateIncident: vi.fn(),
}));

vi.mock('../blog/page-generator.js', () => ({
  generateIncidentPage: vi.fn(),
}));

vi.mock('../blog/newsletter-send.js', () => ({
  sendIncidentNewsletter: vi.fn(),
}));

vi.mock('../blog/subscribe-email.js', () => ({
  sendSubscribeConfirmationEmail: (...args: unknown[]) => sendSubscribeConfirmationEmailMock(...args),
}));

vi.mock('../blog/research-runner.js', () => ({
  runResearchDiscovery: vi.fn(),
}));

vi.mock('../ops/ops-auth.js', () => ({
  authorizeOps: vi.fn(() => true),
}));

const { incidentBlogRouter } = await import('./incident-blog.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/incident-blog', incidentBlogRouter);
  return app;
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = makeApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json() as Record<string, unknown>;
    return { status: res.status, body: payload };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function getRequest(path: string): Promise<{ status: number; location: string | null; body?: Record<string, unknown> }> {
  const app = makeApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual' });
    const contentType = res.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await res.json() as Record<string, unknown>
      : undefined;
    return { status: res.status, location: res.headers.get('location'), body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('incident-blog subscribe API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSubscribeConfirmationEmailMock.mockResolvedValue(undefined);
  });

  it('rejects invalid email', async () => {
    const { status, body } = await postJson('/api/incident-blog/subscribe', { email: 'not-an-email' });
    expect(status).toBe(400);
    expect(body.error).toBe('Invalid email address');
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it('sends confirmation email for new subscriptions', async () => {
    subscribeMock.mockResolvedValue({
      outcome: 'confirmation_sent',
      subscriber: { email: 'reader@example.com', confirmToken: 'token-abc' },
    });
    const { status, body } = await postJson('/api/incident-blog/subscribe', { email: 'reader@example.com' });
    expect(status).toBe(200);
    expect(body.message).toBe('Check your email to confirm your subscription.');
    expect(sendSubscribeConfirmationEmailMock).toHaveBeenCalledWith('reader@example.com', 'token-abc');
  });

  it('resends confirmation email when subscription is already pending', async () => {
    subscribeMock.mockResolvedValue({
      outcome: 'pending',
      subscriber: { email: 'reader@example.com', confirmToken: 'token-abc' },
    });
    const { status, body } = await postJson('/api/incident-blog/subscribe', { email: 'reader@example.com' });
    expect(status).toBe(200);
    expect(body.message).toBe('Check your email to confirm your subscription.');
    expect(sendSubscribeConfirmationEmailMock).toHaveBeenCalledWith('reader@example.com', 'token-abc');
  });

  it('returns already subscribed for confirmed subscribers', async () => {
    subscribeMock.mockResolvedValue({
      outcome: 'already_confirmed',
      subscriber: { email: 'reader@example.com', confirmToken: null },
    });
    const { status, body } = await postJson('/api/incident-blog/subscribe', { email: 'reader@example.com' });
    expect(status).toBe(200);
    expect(body.message).toBe('Already subscribed.');
    expect(sendSubscribeConfirmationEmailMock).not.toHaveBeenCalled();
  });
});

describe('incident-blog confirm and unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to subscribed page on valid confirm token', async () => {
    confirmSubscriberMock.mockResolvedValue(true);
    const { status, location } = await getRequest('/api/incident-blog/confirm?token=token-abc');
    expect(status).toBe(302);
    expect(location).toBe('https://labyrinthscout.com/incidents/?subscribed=true');
  });

  it('redirects to error page on invalid confirm token', async () => {
    confirmSubscriberMock.mockResolvedValue(false);
    const { status, location } = await getRequest('/api/incident-blog/confirm?token=bad');
    expect(status).toBe(302);
    expect(location).toBe('https://labyrinthscout.com/incidents/?error=invalid-token');
  });

  it('redirects to unsubscribed page on valid email', async () => {
    unsubscribeMock.mockResolvedValue(true);
    const { status, location } = await getRequest('/api/incident-blog/unsubscribe?email=reader@example.com');
    expect(status).toBe(302);
    expect(location).toBe('https://labyrinthscout.com/incidents/?unsubscribed=true');
  });
});

describe('incident-blog research API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the latest research run', async () => {
    getLastResearchRunMock.mockResolvedValue({
      id: 'run-1',
      runAt: new Date('2026-06-23T12:00:00.000Z'),
      triggeredBy: 'admin-ui',
      foundCount: 3,
      draftedCount: 2,
      skippedCount: 1,
      errorLog: null,
    });
    const { status, body } = await getRequest('/api/incident-blog/admin/research-status');
    expect(status).toBe(200);
    expect((body?.run as Record<string, unknown>).triggeredBy).toBe('admin-ui');
    expect((body?.run as Record<string, unknown>).draftedCount).toBe(2);
  });

  it('returns research run history with default limit', async () => {
    listResearchRunsMock.mockResolvedValue([
      {
        id: 'run-2',
        runAt: new Date('2026-06-23T11:00:00.000Z'),
        triggeredBy: 'cli',
        foundCount: 1,
        draftedCount: 1,
        skippedCount: 0,
        errorLog: null,
      },
      {
        id: 'run-1',
        runAt: new Date('2026-06-22T11:00:00.000Z'),
        triggeredBy: 'check-in',
        foundCount: 0,
        draftedCount: 0,
        skippedCount: 0,
        errorLog: 'rate limited',
      },
    ]);
    const { status, body } = await getRequest('/api/incident-blog/admin/research-log');
    expect(status).toBe(200);
    expect(listResearchRunsMock).toHaveBeenCalledWith(20);
    const runs = body?.runs as Array<Record<string, unknown>>;
    expect(runs).toHaveLength(2);
    expect(runs[0].triggeredBy).toBe('cli');
    expect(runs[1].errorLog).toBe('rate limited');
  });

  it('caps research log limit query param at 100', async () => {
    listResearchRunsMock.mockResolvedValue([]);
    const { status } = await getRequest('/api/incident-blog/admin/research-log?limit=500');
    expect(status).toBe(200);
    expect(listResearchRunsMock).toHaveBeenCalledWith(100);
  });
});
