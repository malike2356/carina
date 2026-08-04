import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { buildWebContext } from './web-context.js';

vi.mock('../brain/llm.js', () => ({
  llm: {
    current: () => ({ name: 'deepseek' }),
    list: () => ['deepseek', 'anthropic'],
  },
}));

vi.mock('../billing/tenant-scout.js', () => ({
  scoutServiceUrl: () => 'http://scout.test',
}));

function fakeReq(hostname: string): Request {
  return { hostname } as Request;
}

describe('web-context', () => {
  const prevHosted = process.env.HOSTED_MODE;
  const prevHosts = process.env.CARINA_OPERATOR_HOSTS;

  beforeEach(() => {
    process.env.HOSTED_MODE = 'true';
    process.env.CARINA_OPERATOR_HOSTS = 'core.carinaai.uk,localhost';
  });

  afterEach(() => {
    process.env.HOSTED_MODE = prevHosted;
    process.env.CARINA_OPERATOR_HOSTS = prevHosts;
  });
  it('returns private mode for core.carinaai.uk', async () => {
    const body = await buildWebContext(fakeReq('core.carinaai.uk'));
    expect(body.mode).toBe('private');
    expect(body.surface.productName).toBe('Carina');
    expect(body.surface.instanceNav.some((item) => item.id === 'control')).toBe(true);
    expect(body.providers).toContain('deepseek');
    expect(body.hosted).toBeUndefined();
  });

  it('returns hosted mode shell for app.carinaai.uk without session', async () => {
    const body = await buildWebContext(fakeReq('app.carinaai.uk'));
    expect(body.mode).toBe('hosted');
    expect(body.surface.productName).toBe('Carina Cloud');
    expect(body.surface.accountNav.some((item) => item.id === 'billing')).toBe(true);
    expect(body.hosted).toEqual({ user: null });
  });
});
