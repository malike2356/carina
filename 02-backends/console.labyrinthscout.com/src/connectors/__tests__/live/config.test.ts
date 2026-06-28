import { describe, expect, it } from 'vitest';
import {
  getConnectorLiveConfig,
  listConfiguredConnectorIds,
  liveTestsEnabled,
  sampleFindingForConnector,
} from './config.js';

describe('connector live config helpers', () => {
  it('detects live test env flag', () => {
    expect(typeof liveTestsEnabled()).toBe('boolean');
  });

  it('filters empty connector config entries', () => {
    const file = {
      connectors: {
        jira: { email: 'ops@example.com', apiToken: '' },
        pagerduty: { routingKey: 'pd-key' },
      },
    };
    expect(getConnectorLiveConfig(file, 'jira')).toEqual({ email: 'ops@example.com' });
    expect(getConnectorLiveConfig(file, 'pagerduty')).toEqual({ routingKey: 'pd-key' });
    expect(listConfiguredConnectorIds(file)).toEqual(['jira', 'pagerduty']);
  });

  it('builds connector-specific sample findings', () => {
    const accountId = '00000000-0000-4000-8000-000000000001';
    expect(sampleFindingForConnector('snyk', accountId).type).toBe('vulnerability');
    expect(sampleFindingForConnector('socket', accountId).type).toBe('tool_abuse');
    expect(sampleFindingForConnector('sentinelone', accountId).type).toBe('prompt_injection');
  });
});
