import express from 'express';
import session from 'express-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../webhooks/store.js', () => ({
  listSubscriptions: vi.fn(),
  createSubscription: vi.fn(),
  getSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  disableSubscription: vi.fn(),
  enableSubscription: vi.fn(),
  subscriptionPayload: vi.fn((s: { id: string }) => ({ id: s.id })),
  WEBHOOK_EVENTS: ['agent.turn.complete'],
}));

vi.mock('../webhooks/webhook-delivery.js', () => ({
  listDeliveries: vi.fn(),
  deliveryPayload: vi.fn((d: { id: string }) => ({ id: d.id })),
}));

vi.mock('../webhooks/dispatcher.js', () => ({
  dispatchWebhook: vi.fn(),
  retryDelivery: vi.fn(),
}));

const { webhookApiRouter } = await import('./webhook-api.js');
const store = await import('../webhooks/store.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    req.session.webAuthed = true;
    next();
  });
  app.use('/api/webhooks', webhookApiRouter);
  return app;
}

async function getJson(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = makeApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await res.json() as Record<string, unknown>;
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('webhook-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists subscriptions', async () => {
    vi.mocked(store.listSubscriptions).mockResolvedValue([
      {
        id: 's1',
        url: 'https://x.test/h',
        events: ['agent.turn.complete'],
        secret: null,
        active: true,
        name: null,
        description: null,
        maxAttempts: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        disabledAt: null,
      },
    ]);
    const { status, body } = await getJson('/api/webhooks/');
    expect(status).toBe(200);
    expect((body.subscriptions as unknown[]).length).toBe(1);
  });
});
