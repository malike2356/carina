import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScoutFinding } from '../types.js';
import { ConnectorRouter, resetConnectorRouter } from '../router.js';

const queryMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../lib/connector-config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/connector-config.js')>();
  return {
    ...actual,
    createInitializedConnector: vi.fn(),
    loadEnabledConnectorRoutes: vi.fn(),
    storeVendorRef: vi.fn(),
  };
});

import {
  createInitializedConnector,
  loadEnabledConnectorRoutes,
  storeVendorRef,
} from '../../lib/connector-config.js';

function sampleFinding(overrides: Partial<ScoutFinding> = {}): ScoutFinding {
  return {
    id: 'finding-1',
    type: 'prompt_injection',
    severity: 'high',
    title: 'Injection blocked',
    description: 'Blocked prompt injection attempt',
    agentId: 'agent-1',
    agentName: 'Agent One',
    sessionId: 'session-1',
    timestamp: '2026-06-25T12:00:00.000Z',
    mitreAttackIds: ['T1059'],
    riskScore: 80,
    accountId: 'account-1',
    ...overrides,
  };
}

describe('ConnectorRouter', () => {
  beforeEach(() => {
    resetConnectorRouter();
    vi.mocked(loadEnabledConnectorRoutes).mockReset();
    vi.mocked(createInitializedConnector).mockReset();
    vi.mocked(storeVendorRef).mockReset();
  });

  it('routes findings to matching connectors', async () => {
    vi.mocked(loadEnabledConnectorRoutes).mockResolvedValue([
      {
        id: 'route-1',
        connector_id: 'generic-webhook',
        account_id: 'account-1',
        finding_types: null,
        min_severity: 'medium',
        route_alerts: true,
        enabled: true,
        priority: 0,
      },
    ]);

    const pushFinding = vi.fn().mockResolvedValue({
      ok: true,
      vendorId: 'vendor-1',
      pushedAt: new Date().toISOString(),
    });
    const shutdown = vi.fn().mockResolvedValue(undefined);

    vi.mocked(createInitializedConnector).mockResolvedValue({
      connector: { pushFinding, shutdown } as never,
      configRow: {
        id: 'cfg-1',
        connector_id: 'generic-webhook',
        account_id: 'account-1',
        config: {},
        enabled: true,
        last_health: null,
        created_at: '',
        updated_at: '',
      },
    });

    const router = new ConnectorRouter();
    await router.pushFinding(sampleFinding());

    expect(pushFinding).toHaveBeenCalledTimes(1);
    expect(storeVendorRef).toHaveBeenCalledWith(
      expect.objectContaining({
        scoutFindingId: 'finding-1',
        connectorId: 'generic-webhook',
        vendorId: 'vendor-1',
      }),
    );
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('skips connectors not matching finding type', async () => {
    vi.mocked(loadEnabledConnectorRoutes).mockResolvedValue([
      {
        id: 'route-1',
        connector_id: 'snyk',
        account_id: 'account-1',
        finding_types: ['vulnerability'],
        min_severity: 'medium',
        route_alerts: true,
        enabled: true,
        priority: 0,
      },
    ]);

    const router = new ConnectorRouter();
    await router.pushFinding(sampleFinding({ type: 'prompt_injection' }));

    expect(createInitializedConnector).not.toHaveBeenCalled();
  });

  it('handles connector errors gracefully', async () => {
    vi.mocked(loadEnabledConnectorRoutes).mockResolvedValue([
      {
        id: 'route-1',
        connector_id: 'generic-webhook',
        account_id: 'account-1',
        finding_types: null,
        min_severity: 'medium',
        route_alerts: true,
        enabled: true,
        priority: 0,
      },
    ]);

    vi.mocked(createInitializedConnector).mockRejectedValue(new Error('init failed'));

    const router = new ConnectorRouter();
    await expect(router.pushFinding(sampleFinding())).resolves.toBeUndefined();
  });
});
