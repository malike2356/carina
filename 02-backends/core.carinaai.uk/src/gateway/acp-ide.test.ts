import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { setupAcpIdeRoutes } from './acp-ide.js';
import { validateAcpIdeHealthPayload } from './acp-compliance.js';

describe('acp-ide routes integration', () => {
  let server: Server;
  let port: number;
  const originalAcp = process.env.CARINA_ACP_ENABLED;

  beforeEach(async () => {
    process.env.CARINA_ACP_ENABLED = 'true';
    const app = express();
    app.use(express.json());
    setupAcpIdeRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (originalAcp === undefined) delete process.env.CARINA_ACP_ENABLED;
    else process.env.CARINA_ACP_ENABLED = originalAcp;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns IDE health payload', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/acp/ide/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(validateAcpIdeHealthPayload(body)).toHaveLength(0);
  });

  it('returns capabilities', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/acp/ide/capabilities`);
    expect(res.status).toBe(200);
    const body = await res.json() as { protocol: string; features: string[] };
    expect(body.protocol).toBe('acp-ide-v1');
    expect(body.features).toContain('chat');
  });

  it('rejects chat without prompt', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/acp/ide/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
