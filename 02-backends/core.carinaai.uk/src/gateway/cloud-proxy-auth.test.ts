import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { isCloudProxyAuthorized, isCloudProxyApiPath } from './cloud-proxy-auth.js';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as Request;
}

describe('cloud-proxy-auth', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.CARINA_OPS_TOKEN = 'ops-secret';
    delete process.env.SCOUT_OPS_TOKEN;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('accepts bearer ops token', () => {
    const req = mockReq({ authorization: 'Bearer ops-secret' });
    expect(isCloudProxyAuthorized(req)).toBe(true);
  });

  it('accepts x-internal-key', () => {
    const req = mockReq({ 'x-internal-key': 'ops-secret' });
    expect(isCloudProxyAuthorized(req)).toBe(true);
  });

  it('accepts scout ops token', () => {
    process.env.SCOUT_OPS_TOKEN = 'scout-secret';
    const req = mockReq({ 'x-scout-token': 'scout-secret' });
    expect(isCloudProxyAuthorized(req)).toBe(true);
  });

  it('rejects missing credentials', () => {
    expect(isCloudProxyAuthorized(mockReq())).toBe(false);
  });

  it('rejects wrong bearer', () => {
    const req = mockReq({ authorization: 'Bearer wrong' });
    expect(isCloudProxyAuthorized(req)).toBe(false);
  });
});

describe('isCloudProxyApiPath', () => {
  it('includes tenant proxy APIs', () => {
    expect(isCloudProxyApiPath('/api/aiva/subscription/status')).toBe(true);
    expect(isCloudProxyApiPath('/api/aiva/workers')).toBe(true);
    expect(isCloudProxyApiPath('/api/conversations')).toBe(true);
    expect(isCloudProxyApiPath('/api/workspace/export')).toBe(true);
    expect(isCloudProxyApiPath('/api/channels')).toBe(true);
    expect(isCloudProxyApiPath('/api/analytics/overview')).toBe(true);
    expect(isCloudProxyApiPath('/api/agent-sync/status')).toBe(true);
    expect(isCloudProxyApiPath('/api/agent-sync')).toBe(true);
  });

  it('excludes external webhooks', () => {
    expect(isCloudProxyApiPath('/api/aiva/webhooks/propreneur')).toBe(false);
    expect(isCloudProxyApiPath('/api/channels/webhook/slack')).toBe(false);
  });

  it('excludes unrelated APIs', () => {
    expect(isCloudProxyApiPath('/api/chat')).toBe(false);
    expect(isCloudProxyApiPath('/api/health')).toBe(false);
  });
});
