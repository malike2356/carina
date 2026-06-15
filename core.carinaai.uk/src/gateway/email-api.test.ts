import express from 'express';
import session from 'express-session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';

const queryMock = vi.hoisted(() => vi.fn());

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

async function mountEmailRouter(authed: boolean): Promise<{ server: Server; port: number }> {
  vi.resetModules();
  const { emailApiRouter } = await import('./email-api.js');
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  if (authed) {
    app.use((req, _res, next) => {
      req.session.webAuthed = true;
      next();
    });
  }
  app.use('/api/email', emailApiRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

async function request(
  port: number,
  method: string,
  route: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

describe('email-api', () => {
  let server: Server | undefined;

  beforeEach(() => {
    queryMock.mockReset();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it('lists inbox emails', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'email-1',
          from_address: 'sender@example.com',
          to_address: 'inbox@carina.local',
          subject: 'Hello',
          body_text: 'Please review',
          body_html: null,
          message_id: 'msg-1',
          read: false,
          urgency: 'high',
          triage_status: 'inbox',
          received_at: '2026-06-15T10:00:00.000Z',
        }],
      });

    ({ server } = await mountEmailRouter(true));
    const port = (server!.address() as { port: number }).port;
    const result = await request(port, 'GET', '/api/email?status=inbox');
    expect(result.status).toBe(200);
    expect((result.json?.emails as unknown[]).length).toBe(1);
    expect((result.json?.emails as Array<{ urgency: string }>)[0].urgency).toBe('high');
  });

  it('patches urgency and read state', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'email-1',
        from_address: 'sender@example.com',
        to_address: 'inbox@carina.local',
        subject: 'Hello',
        body_text: 'Body',
        body_html: null,
        message_id: 'msg-1',
        read: true,
        urgency: 'normal',
        triage_status: 'inbox',
        received_at: '2026-06-15T10:00:00.000Z',
      }],
    });

    ({ server } = await mountEmailRouter(true));
    const port = (server!.address() as { port: number }).port;
    const result = await request(port, 'PATCH', '/api/email/email-1', {
      read: true,
      urgency: 'normal',
    });
    expect(result.status).toBe(200);
    expect(result.json?.read).toBe(true);
  });

  it('archives an email', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'email-1',
        from_address: 'sender@example.com',
        to_address: 'inbox@carina.local',
        subject: 'Hello',
        body_text: 'Body',
        body_html: null,
        message_id: 'msg-1',
        read: true,
        urgency: 'normal',
        triage_status: 'archived',
        received_at: '2026-06-15T10:00:00.000Z',
      }],
    });

    ({ server } = await mountEmailRouter(true));
    const port = (server!.address() as { port: number }).port;
    const result = await request(port, 'POST', '/api/email/email-1/archive');
    expect(result.status).toBe(200);
    expect(result.json?.triage_status).toBe('archived');
  });

  it('returns 401 when unauthenticated', async () => {
    ({ server } = await mountEmailRouter(false));
    const port = (server!.address() as { port: number }).port;
    const result = await request(port, 'GET', '/api/email');
    expect(result.status).toBe(401);
  });
});
