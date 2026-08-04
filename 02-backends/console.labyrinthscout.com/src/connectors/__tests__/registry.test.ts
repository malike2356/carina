import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConnector,
  listConnectorDefinitions,
  listByCategory,
  registerConnectorFactory,
  resetConnectorRegistry,
} from '../registry.js';
import { GenericWebhookConnector } from '../generic-webhook.js';

describe('ConnectorRegistry', () => {
  beforeEach(() => {
    resetConnectorRegistry();
    registerConnectorFactory('generic-webhook', () => new GenericWebhookConnector());
  });

  it('registers and retrieves connectors', () => {
    const connector = createConnector('generic-webhook');
    expect(connector?.id).toBe('generic-webhook');
  });

  it('lists by category', () => {
    expect(listByCategory('siem').map((c) => c.id)).toContain('generic-webhook');
    expect(listByCategory('ticketing')).toHaveLength(0);
  });

  it('prevents duplicate registration', () => {
    expect(() =>
      registerConnectorFactory('generic-webhook', () => new GenericWebhookConnector()),
    ).toThrow(/already registered/);
  });

  it('lists connector definitions', () => {
    expect(listConnectorDefinitions()).toHaveLength(1);
  });
});
