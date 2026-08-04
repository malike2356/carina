import { describe, expect, it } from 'vitest';
import { nextResponseFromUpstream } from './next-upstream-response';

describe('nextResponseFromUpstream', () => {
  it('returns null body for 204', async () => {
    const upstream = new Response(null, { status: 204 });
    const next = await nextResponseFromUpstream(upstream);
    expect(next.status).toBe(204);
    expect(await next.text()).toBe('');
  });

  it('preserves JSON body for 200', async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const next = await nextResponseFromUpstream(upstream);
    expect(next.status).toBe(200);
    expect(await next.json()).toEqual({ ok: true });
  });
});
