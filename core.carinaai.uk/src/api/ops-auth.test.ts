import { describe, expect, it } from 'vitest';
import { authorizeOps } from '../ops/ops-auth.js';

describe('ops-auth', () => {
  it('rejects requests without a valid ops token', () => {
    process.env.CARINA_OPS_TOKEN = 'secret-token';
    expect(authorizeOps({ headers: {} })).toBe(false);
    delete process.env.CARINA_OPS_TOKEN;
  });

  it('accepts bearer ops tokens', () => {
    process.env.CARINA_OPS_TOKEN = 'secret-token';
    expect(
      authorizeOps({ headers: { authorization: 'Bearer secret-token' } }),
    ).toBe(true);
    delete process.env.CARINA_OPS_TOKEN;
  });
});
