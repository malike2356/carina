import express from 'express';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';
import { mountOpsRoutes } from './ops-routes.js';

describe('ops-routes', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    process.env.CARINA_OPS_TOKEN = 'test-ops-token-123456';
    process.env.CHANNEL_CREDENTIAL_KEY = 'a'.repeat(64);
    const app = express();
    app.use(express.json());
    mountOpsRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    delete process.env.CARINA_OPS_TOKEN;
    delete process.env.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN;
    delete process.env.AIVA_HUMAN_ASSIST_MIS_URL;
    delete process.env.AIVA_HUMAN_ASSIST_PUBLISH_MODE;
    delete process.env.CHANNEL_CREDENTIAL_KEY;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects reload without token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/reload-secrets`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('reloads secrets with bearer token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/reload-secrets`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('rejects skill pack reads without token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/skill-packs`);
    expect(res.status).toBe(401);
  });

  it('returns available and active skill packs for ops', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/skill-packs`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { available: Array<{ name: string }>; active: string[]; source: string };
    expect(body.source).toBe('persisted');
    expect(body.available.some((pack) => pack.name === 'finance')).toBe(true);
    expect(Array.isArray(body.active)).toBe(true);
  });

  it('rejects unknown packs on save', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/skill-packs`, {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-ops-token-123456',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ packs: ['not-a-real-pack'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { invalid: string[] };
    expect(body.invalid).toEqual(['not-a-real-pack']);
  });

  it('saves valid skill packs for ops', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/skill-packs`, {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-ops-token-123456',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ packs: ['finance'], actor: 'test', source: 'vitest' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; active: string[] };
    expect(body.ok).toBe(true);
    expect(body.active).toEqual(['finance']);
  });

  it('rejects web password updates without token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/web-password`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'long-enough-password', confirmPassword: 'long-enough-password' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns read-only extension bundle listing for ops', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/extensions`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      extensions: unknown[];
      runtimeEnabled: boolean;
      source: string;
    };
    expect(body.source).toBe('read-only');
    expect(Array.isArray(body.extensions)).toBe(true);
    expect(typeof body.runtimeEnabled).toBe('boolean');
  });

  it('returns a sanitized environment summary for ops', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/environment`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      environment: {
        envPath: string;
        envExists: boolean;
        settings: Array<{ key: string; value: string; sensitive: boolean }>;
        audit: { ok: number; warn: number; fail: number };
      };
    };
    expect(body.environment.envPath).toContain('.env');
    expect(body.environment.envExists).toBeTypeOf('boolean');
    expect(body.environment.settings.some((item) => item.key === 'CARINA_HOME')).toBe(true);
    expect(body.environment.settings.every((item) => typeof item.value === 'string')).toBe(true);
  });

  it('accepts x-internal-key for environment summary', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/environment`, {
      headers: { 'x-internal-key': 'test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { environment: { envPath: string } };
    expect(body.environment.envPath).toContain('.env');
  });

  it('returns human assist bridge status for ops', async () => {
    process.env.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN = 'bridge-token-123456';
    process.env.AIVA_HUMAN_ASSIST_MIS_URL = 'https://verlox.uk';
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/human-assist/bridge`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      enabled: boolean;
      misBaseUrl: string;
      bridgeTokenSet: boolean;
      publishMode: string;
      misInboxUrl: string;
    };
    expect(body.enabled).toBe(true);
    expect(body.misBaseUrl).toBe('https://verlox.uk');
    expect(body.bridgeTokenSet).toBe(true);
    expect(body.publishMode).toBe('push_and_poll');
    expect(body.misInboxUrl).toBe('https://verlox.uk/mis/va/aiva-assist');
  });

  it('saves human assist bridge status for ops', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/human-assist/bridge`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-ops-token-123456',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        enabled: true,
        misBaseUrl: 'https://verlox.uk/',
        bridgeToken: 'bridge-token-abcdef',
        publishMode: 'poll_only',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      enabled: boolean;
      misBaseUrl: string;
      bridgeTokenSet: boolean;
      publishMode: string;
    };
    expect(body.enabled).toBe(true);
    expect(body.misBaseUrl).toBe('https://verlox.uk');
    expect(body.bridgeTokenSet).toBe(true);
    expect(body.publishMode).toBe('poll_only');
  });

  it('updates core web password for ops', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/web-password`, {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-ops-token-123456',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        password: 'long-enough-password',
        confirmPassword: 'long-enough-password',
        actor: 'vitest',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; set: boolean };
    expect(body.ok).toBe(true);
    expect(body.set).toBe(true);
  });
});
