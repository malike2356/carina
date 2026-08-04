import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ScoutClient } from '../client.js';
import { scoutMiddleware } from '../middleware.js';

function buildApp(middleware: ReturnType<typeof scoutMiddleware>) {
  const app = express();
  app.use(express.json());
  app.post('/chat', middleware, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('scoutMiddleware', () => {
  const evaluateAndWait = vi.fn();
  const scout = { evaluateAndWait } as unknown as ScoutClient;

  beforeEach(() => {
    evaluateAndWait.mockReset();
    evaluateAndWait.mockResolvedValue({
      proceed: true,
      decision: { decision: 'allow', reason: 'ok', riskScore: 0, actionType: 'http', shieldMode: 'observe' },
    });
  });

  it('scoutMiddleware: passes request through when decision=allow', async () => {
    const app = buildApp(scoutMiddleware({ scout, agentType: 'openai' }));
    const res = await request(app)
      .post('/chat')
      .send({ messages: [{ role: 'user', content: 'hello' }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('scoutMiddleware: returns 403 with policy_blocked code when decision=block', async () => {
    evaluateAndWait.mockResolvedValue({
      proceed: false,
      decision: { decision: 'block', reason: 'blocked', riskScore: 90, actionType: 'http', shieldMode: 'observe' },
      reason: 'blocked',
    });
    const app = buildApp(scoutMiddleware({ scout, agentType: 'openai' }));
    const res = await request(app)
      .post('/chat')
      .send({ messages: [{ role: 'user', content: 'bad prompt' }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('policy_blocked');
  });

  it('scoutMiddleware: passes through when Scout throws (fail open on network error)', async () => {
    evaluateAndWait.mockRejectedValue(new Error('network error'));
    const app = buildApp(scoutMiddleware({ scout, agentType: 'openai' }));
    const res = await request(app)
      .post('/chat')
      .send({ messages: [{ role: 'user', content: 'hello' }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('scoutMiddleware: passes through when prompt is empty (nothing to evaluate)', async () => {
    const app = buildApp(scoutMiddleware({ scout, agentType: 'openai' }));
    const res = await request(app).post('/chat').send({ messages: [] });
    expect(res.status).toBe(200);
    expect(evaluateAndWait).not.toHaveBeenCalled();
  });
});
