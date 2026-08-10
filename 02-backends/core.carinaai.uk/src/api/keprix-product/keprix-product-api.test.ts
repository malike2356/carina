/**
 * Tests for Carina southbound Keprix product API (CAS-03).
 */
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mountKeprixProductApi } from './keprix-product-api.js';
import { invokeProductTool } from '../../workers/product-tools/invoke.js';
import { clearSessionTools, registerSessionTool } from '../../tools/session-tool-store.js';
import { clearWorkerSessionContext, setWorkerSessionContext } from '../../workers/worker-session-context.js';
import type { WorkerContext } from '../../types/index.js';

vi.mock('../../workers/product-tools/invoke.js', () => ({
  invokeProductTool: vi.fn(),
}));

describe('keprix product API (CAS-03)', () => {
  const prev = process.env.CARINA_KEPRIX_SHARED_TOKEN;
  let base = '';
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    process.env.CARINA_KEPRIX_SHARED_TOKEN = 'test-shared';
    const app = express();
    app.use(express.json());
    mountKeprixProductApi(app);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    if (prev === undefined) delete process.env.CARINA_KEPRIX_SHARED_TOKEN;
    else process.env.CARINA_KEPRIX_SHARED_TOKEN = prev;
  });

  it('health is public', async () => {
    const res = await fetch(`${base}/api/keprix/v1/health`);
    assert.equal(res.status, 200);
  });

  it('context strips secrets', async () => {
    const res = await fetch(`${base}/api/keprix/v1/context?workspace_id=w1`, {
      headers: { Authorization: 'Bearer test-shared' },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.workspace_id, 'w1');
    assert.equal(body.password, undefined);
    assert.equal(body.token, undefined);
  });

  it('propose apply requires approval and is idempotent', async () => {
    const headers = {
      Authorization: 'Bearer test-shared',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-1',
    };
    const denied = await fetch(`${base}/api/keprix/v1/crm/propose/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    assert.equal(denied.status, 403);

    const a = await fetch(`${base}/api/keprix/v1/crm/propose/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ approval_id: 'ap1' }),
    });
    const b = await fetch(`${base}/api/keprix/v1/crm/propose/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ approval_id: 'ap1' }),
    });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(await a.json(), await b.json());
  });

  it('executes a session tool only with matching trusted bindings', async () => {
    const sessionId = 'telegram:test-session';
    let received: Record<string, unknown> = {};
    setWorkerSessionContext(sessionId, {
      worker: { id: 'worker-1', workspaceId: 'workspace-1' },
      personaPrompt: 'test',
    } as WorkerContext);
    registerSessionTool(sessionId, {
      name: 'vault_list',
      description: 'List vault files',
      parameters: { type: 'object', properties: {} },
      execute: async (params) => {
        received = params;
        return { success: true };
      },
    });
    const headers = {
      Authorization: 'Bearer test-shared',
      'Content-Type': 'application/json',
      'X-Keprix-Trusted-Workspace-Id': 'workspace-1',
      'X-Keprix-Trusted-Actor-Id': 'worker-1',
      'X-Keprix-Trusted-Conversation-Id': sessionId,
      'X-Keprix-Trusted-Product': 'aiva',
    };
    const response = await fetch(
      `${base}/api/keprix/v1/tools/${encodeURIComponent(sessionId)}/vault_list`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ folder: 'Leads', workspace_id: 'attacker', actor_id: 'attacker' }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(received, { folder: 'Leads' });

    const denied = await fetch(
      `${base}/api/keprix/v1/tools/${encodeURIComponent(sessionId)}/vault_list`,
      {
        method: 'POST',
        headers: { ...headers, 'X-Keprix-Trusted-Workspace-Id': 'workspace-2' },
        body: '{}',
      },
    );
    assert.equal(denied.status, 403);
    clearSessionTools(sessionId);
    clearWorkerSessionContext(sessionId);
  });

  it('executes canonical Gmail tools without an in-memory session', async () => {
    vi.mocked(invokeProductTool).mockResolvedValueOnce({
      ok: true,
      data: { messages: [] },
    });
    const sessionId = 'telegram:stateless-gmail-session';
    const headers = {
      Authorization: 'Bearer test-shared',
      'Content-Type': 'application/json',
      'X-Keprix-Trusted-Workspace-Id': 'workspace-1',
      'X-Keprix-Trusted-Actor-Id': 'worker-1',
      'X-Keprix-Trusted-Conversation-Id': sessionId,
      'X-Keprix-Trusted-Product': 'aiva',
    };
    const response = await fetch(
      `${base}/api/keprix/v1/tools/${encodeURIComponent(sessionId)}/gmail-list`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit: 3, q: 'in:anywhere', workspace_id: 'attacker' }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, data: { messages: [] } });
    expect(invokeProductTool).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      workerId: 'worker-1',
      slug: 'gmail',
      action: 'list',
      input: { q: 'in:anywhere', maxResults: 3 },
    });
  });

  it('does not execute guarded tools through the sidecar callback', async () => {
    const sessionId = 'telegram:guarded-session';
    let executed = false;
    setWorkerSessionContext(sessionId, {
      worker: { id: 'worker-1', workspaceId: 'workspace-1' },
      personaPrompt: 'test',
    } as WorkerContext);
    registerSessionTool(sessionId, {
      name: 'vault_delete',
      description: 'Delete a vault file',
      parameters: { type: 'object', properties: {} },
      dangerous: true,
      execute: async () => {
        executed = true;
        return { success: true };
      },
    });
    const response = await fetch(
      `${base}/api/keprix/v1/tools/${encodeURIComponent(sessionId)}/vault_delete`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-shared',
          'Content-Type': 'application/json',
          'X-Keprix-Trusted-Workspace-Id': 'workspace-1',
          'X-Keprix-Trusted-Actor-Id': 'worker-1',
          'X-Keprix-Trusted-Conversation-Id': sessionId,
          'X-Keprix-Trusted-Product': 'aiva',
        },
        body: '{}',
      },
    );
    assert.equal(response.status, 403);
    assert.equal(executed, false);
    clearSessionTools(sessionId);
    clearWorkerSessionContext(sessionId);
  });
});
