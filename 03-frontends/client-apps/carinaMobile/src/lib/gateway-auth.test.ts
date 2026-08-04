import { describe, expect, it } from 'vitest';
import { authFromInstance, buildGatewayHeaders, mergeGatewayInit } from './gateway-auth';

describe('gateway-auth', () => {
  it('uses bearer session token for cloud mode', () => {
    expect(authFromInstance('cloud', 'session-token')).toEqual({
      credentials: 'omit',
      apiKey: 'session-token',
    });
  });

  it('uses bearer api key for self-hosted mode', () => {
    expect(authFromInstance('self-hosted', 'carina_test_key')).toEqual({
      credentials: 'omit',
      apiKey: 'carina_test_key',
    });
  });

  it('builds authorization header when api key is present', () => {
    expect(buildGatewayHeaders({ apiKey: 'carina_test_key' }).Authorization).toBe(
      'Bearer carina_test_key',
    );
  });

  it('adds device token header when present', () => {
    expect(buildGatewayHeaders({ deviceToken: 'cdv_test' })['X-Device-Token']).toBe('cdv_test');
  });

  it('mergeGatewayInit preserves caller headers', () => {
    const init = mergeGatewayInit(
      authFromInstance('self-hosted', 'carina_test_key'),
      { headers: { 'X-Test': '1' } },
    );
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer carina_test_key');
    expect((init.headers as Record<string, string>)['X-Test']).toBe('1');
  });

  it('omits authorization header when cloud has no session token yet', () => {
    const headers = buildGatewayHeaders(authFromInstance('cloud', null));
    expect(headers.Authorization).toBeUndefined();
  });
});
