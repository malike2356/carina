import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => null,
}));

import { policyEvaluateRouter } from '../policy-evaluate.js';
import { resetPolicyGatewayDeps, setPolicyGatewayDeps } from '../../security/policy-gateway.js';
import { resetShieldModesForTests, setShieldMode } from '../../security/session-shield.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/policy', policyEvaluateRouter);
  return app;
}

describe('policyEvaluateRouter', () => {
  beforeEach(() => {
    resetPolicyGatewayDeps();
    resetShieldModesForTests();
    setPolicyGatewayDeps({
      logDecision: vi.fn().mockResolvedValue(undefined),
      isSessionBlocked: async () => false,
      isToolQuarantined: async () => false,
    });
  });

  afterEach(() => {
    resetPolicyGatewayDeps();
    resetShieldModesForTests();
  });

  it('evaluates policy for a tool call', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policy/evaluate')
      .send({ session_id: 's1', tool_name: 'web-search' });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('allow');
    expect(res.body.actionType).toBeDefined();
  });

  it('returns block for dangerous shell commands', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policy/evaluate')
      .send({
        session_id: 's2',
        action_type: 'shell',
        tool_name: 'shell-exec',
        params: { command: 'rm -rf /' },
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('block');
  });

  it('evaluates context firewall', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policy/context')
      .send({
        session_id: 's3',
        content: 'Hello, how can I help?',
        context_type: 'user_prompt',
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('allow');
  });

  it('returns quarantine when session shield mode is quarantine', async () => {
    await setShieldMode('s4', 'quarantine', 'test');
    const app = buildApp();
    const res = await request(app)
      .post('/api/policy/evaluate')
      .send({ session_id: 's4', tool_name: 'web-search' });

    expect(res.body.decision).toBe('quarantine_session');
  });

  it('validates required fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/policy/evaluate').send({});
    expect(res.status).toBe(400);
  });
});
