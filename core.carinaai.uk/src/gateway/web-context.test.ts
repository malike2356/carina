import { describe, expect, it, vi } from 'vitest';
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

vi.mock('./hosted-domain.js', () => ({
  isHostedRequest: (host: string) => host === 'app.carinaai.uk',
}));

function fakeReq(hostname: string): Request {
  return { hostname } as Request;
}

describe('web-context', () => {
  it('returns operator mode for core.carinaai.uk', async () => {
    const body = await buildWebContext(fakeReq('core.carinaai.uk'));
    expect(body.mode).toBe('operator');
    expect(body.providers).toContain('deepseek');
    expect(body.hosted).toBeUndefined();
  });

  it('returns hosted mode shell for app.carinaai.uk without session', async () => {
    const body = await buildWebContext(fakeReq('app.carinaai.uk'));
    expect(body.mode).toBe('hosted');
    expect(body.hosted).toEqual({ user: null });
  });
});
