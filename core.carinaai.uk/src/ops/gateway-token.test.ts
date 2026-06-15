import { describe, expect, it } from 'vitest';
import { generateGatewayOpsToken, gatewayOpsTokenStatus } from './gateway-token.js';

describe('gateway-token', () => {
  it('generates token with cop_ prefix', () => {
    const token = generateGatewayOpsToken();
    expect(token.startsWith('cop_')).toBe(true);
    expect(token.length).toBeGreaterThan(24);
  });

  it('reports configured when CARINA_OPS_TOKEN is set', () => {
    process.env.CARINA_OPS_TOKEN = 'cop_test_token_long_enough_value';
    const status = gatewayOpsTokenStatus();
    expect(status.configured).toBe(true);
    expect(status.source).toBe('ops-token');
    delete process.env.CARINA_OPS_TOKEN;
  });
});
