import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { onboardingRouter } from '../api/onboarding-api.js';

vi.mock('../gateway/cloud-proxy-auth.js', () => ({
  requireCloudProxy: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../email/email-triggers.js', () => ({
  sendCompleteWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../aiva/employee-comms.js', () => ({
  seedEmployeeWelcomeThread: vi.fn().mockResolvedValue(null),
}));

async function get(path: string, headers: Record<string, string> = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', onboardingRouter);
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      const listenPort = typeof address === 'object' && address ? address.port : 0;
      try {
        const res = await fetch(`http://127.0.0.1:${listenPort}${path}`, { headers });
        const body = await res.json() as Record<string, unknown>;
        resolve({ status: res.status, body });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

async function post(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', onboardingRouter);
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      const listenPort = typeof address === 'object' && address ? address.port : 0;
      try {
        const res = await fetch(`http://127.0.0.1:${listenPort}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body),
        });
        const payload = await res.json() as Record<string, unknown>;
        resolve({ status: res.status, body: payload });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe('onboarding-api', () => {
  it('lists quick-connect channels sorted by friction', async () => {
    const { status, body } = await get('/api/onboarding/channels');
    expect(status).toBe(200);
    const quickConnect = body.quickConnect as Array<{ id: string; tier: number }>;
    expect(quickConnect[0]?.id).toBe('web');
    expect(quickConnect.some((channel) => channel.id === 'sms')).toBe(false);
  });

  it('returns onboarding start payload with templates and channels', async () => {
    const { status, body } = await get('/api/onboarding/start');
    expect(status).toBe(200);
    expect(Array.isArray(body.templates)).toBe(true);
    expect(Array.isArray(body.channels)).toBe(true);
    expect(body.customTemplate).toMatchObject({ templateId: 'custom' });
  });

  it('returns a single channel by id', async () => {
    const { status, body } = await get('/api/onboarding/channels/telegram');
    expect(status).toBe(200);
    expect(body.channel).toMatchObject({ id: 'telegram', setupType: 'token' });
  });

  it('sends complete welcome email for onboarding completion', async () => {
    const { sendCompleteWelcomeEmail } = await import('../email/email-triggers.js');
    const { seedEmployeeWelcomeThread } = await import('../aiva/employee-comms.js');
    const workspaceId = '11111111-1111-4111-8111-111111111111';
    const { status, body } = await post(
      '/api/onboarding/welcome-email',
      { workerId: 'worker-1', templateId: 'support-agent', channelId: 'telegram' },
      { 'X-Workspace-Id': workspaceId },
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendCompleteWelcomeEmail).toHaveBeenCalledWith({
      workspaceId,
      workerId: 'worker-1',
      templateId: 'support-agent',
      channelId: 'telegram',
    });
    expect(seedEmployeeWelcomeThread).toHaveBeenCalledWith({
      workspaceId,
      workerId: 'worker-1',
    });
  });
});
