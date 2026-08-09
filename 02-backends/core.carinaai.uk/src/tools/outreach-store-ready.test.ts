import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Tool } from '../types/index.js';

vi.mock('../outreach/store.js', () => ({
  ensureOutreachStoreReady: vi.fn(),
}));

import { ensureOutreachStoreReady } from '../outreach/store.js';
import { withOutreachStoreReady } from './outreach-store-ready.js';

describe('withOutreachStoreReady', () => {
  beforeEach(() => {
    vi.mocked(ensureOutreachStoreReady).mockReset();
    vi.mocked(ensureOutreachStoreReady).mockResolvedValue(undefined);
  });

  it('primes the store before executing the tool', async () => {
    const execute = vi.fn(async () => ({ ok: true, data: { total: 10 } }));
    const tool: Tool = {
      name: 'outreach-leads-list',
      description: 'test',
      parameters: { type: 'object', properties: {} },
      execute,
    };
    const wrapped = withOutreachStoreReady(tool);
    const result = await wrapped.execute({});
    expect(ensureOutreachStoreReady).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: { total: 10 } });
  });

  it('returns a soft error when hydrate fails', async () => {
    vi.mocked(ensureOutreachStoreReady).mockRejectedValue(new Error('pg down'));
    const execute = vi.fn(async () => ({ ok: true }));
    const tool: Tool = {
      name: 'outreach-leads-list',
      description: 'test',
      parameters: { type: 'object', properties: {} },
      execute,
    };
    const wrapped = withOutreachStoreReady(tool);
    const result = await wrapped.execute({});
    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: 'Outreach store unavailable: pg down',
    });
  });
});
