import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { createInternalControlRouter } from './control.js';
import { pool } from '../../event-server/db.js';

function startApp(router = createInternalControlRouter(mockService, { internalKey: 'secret-key' })) {
  const app = express();
  app.use(express.json());
  app.use('/api/internal/control', router);
  const server = createServer(app);
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => {
      server.unref();
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected ephemeral port'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((done) => {
          server.close(() => done());
          (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
          (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
        }),
      });
    });
  });
}

const mockService = {
  killOrg: async (organizationId: string, meta?: unknown) => ({
    ok: true as const,
    audit_code: `K-${organizationId}-001`,
  }),
  freezeOrg: async (organizationId: string) => ({
    ok: true as const,
    audit_code: `K-${organizationId}-002`,
  }),
  pauseAgent: async (organizationId: string, agentId: string) => ({
    ok: true as const,
    audit_code: `${organizationId}-${agentId}-pause`,
  }),
  suspendChannel: async (organizationId: string, channel: string) => ({
    ok: true as const,
    audit_code: `${organizationId}-${channel}-suspend`,
  }),
  quarantineTool: async (organizationId: string, agentId: string | 'all', toolName: string) => ({
    ok: true as const,
    audit_code: `${organizationId}-${String(agentId)}-${toolName}`,
  }),
  restrictOrg: async (organizationId: string) => ({
    ok: true as const,
    audit_code: `${organizationId}-restrict`,
  }),
  resumeOrg: async (organizationId: string) => ({
    ok: true as const,
    audit_code: `${organizationId}-resume`,
  }),
  resumeAgent: async (organizationId: string, agentId: string) => ({
    ok: true as const,
    audit_code: `${organizationId}-${agentId}-resume`,
  }),
  getStatus: async (organizationId: string) => ({
    organization_id: organizationId,
    agents: { active: 1, suspended: 0, offline: 0 },
  }),
};

after(async () => {
  await pool.end().catch(() => undefined);
});

describe('internal control router', () => {
  it('rejects missing internal key', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/internal/control', createInternalControlRouter(mockService, { internalKey: 'secret-key' }));
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  server.unref();
  const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/internal/control/kill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Connection: 'close' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    });

    assert.equal(response.status, 401);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
      (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  });

  it('routes kill requests to the service', async () => {
    const app = await startApp();
    const response = await fetch(`${app.baseUrl}/api/internal/control/kill`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Scout-Internal-Key': 'secret-key',
        Connection: 'close',
      },
      body: JSON.stringify({
        organization_id: 'org-1',
        reason: 'policy violation',
        plan: 'scout_pro',
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.audit_code, 'K-org-1-001');
    await app.close();
  });

  it('returns status for an organization', async () => {
    const app = await startApp();
    const response = await fetch(`${app.baseUrl}/api/internal/control/status?organization_id=org-1`, {
      headers: { 'X-Scout-Internal-Key': 'secret-key', Connection: 'close' },
    });

    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.organization_id, 'org-1');
    assert.equal(body.agents.active, 1);
    await app.close();
  });
});
