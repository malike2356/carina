import { afterEach, describe, expect, it } from 'vitest';
import '../../register-all.js';
import { createConnector, listConnectorDefinitions } from '../../registry.js';
import type { SiemConnector } from '../../types.js';
import {
  getConnectorLiveConfig,
  listConfiguredConnectorIds,
  liveTestsEnabled,
  loadLiveConfig,
  LIVE_TEST_TIMEOUT_MS,
  sampleFindingForConnector,
} from './config.js';

const RUN_LIVE = liveTestsEnabled();

describe.skipIf(!RUN_LIVE)('connector live vendor sandbox', () => {
  if (!RUN_LIVE) return;

  const liveFile = loadLiveConfig();
  const accountId = liveFile.accountId ?? '00000000-0000-4000-8000-000000000099';
  const configuredIds = new Set(listConfiguredConnectorIds(liveFile));
  const activeConnectors: SiemConnector[] = [];

  if (configuredIds.size === 0) {
    throw new Error('connectors.live.json has no connector entries with non-empty values');
  }

  afterEach(async () => {
    await Promise.all(activeConnectors.map((connector) => connector.shutdown().catch(() => undefined)));
    activeConnectors.length = 0;
  });

  async function initConnector(connectorId: string): Promise<SiemConnector> {
    const config = getConnectorLiveConfig(liveFile, connectorId);
    if (!config) {
      throw new Error(`Missing live config for connector: ${connectorId}`);
    }

    const connector = createConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector not registered: ${connectorId}`);
    }

    await connector.init(config);
    activeConnectors.push(connector);
    return connector;
  }

  it('reports configured connector count', () => {
    const registered = listConnectorDefinitions().map((c) => c.id);
    const missing = [...configuredIds].filter((id) => !registered.includes(id));
    expect(missing, `unknown connector ids in live config: ${missing.join(', ')}`).toEqual([]);
    expect(configuredIds.size).toBeGreaterThan(0);
  });

  for (const definition of listConnectorDefinitions()) {
    const connectorId = definition.id;

    describe(connectorId, () => {
      it.skipIf(!configuredIds.has(connectorId))(
        'health check reaches vendor sandbox',
        async () => {
          const connector = await initConnector(connectorId);
          const health = await connector.health();
          expect(health.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          expect(health.latencyMs).toBeGreaterThanOrEqual(0);

          if (!health.ok) {
            console.warn(`[live:${connectorId}] health failed: ${health.error ?? 'unknown'}`);
          }
          expect(health.ok, health.error ?? 'health check failed').toBe(true);
        },
        LIVE_TEST_TIMEOUT_MS,
      );

      it.skipIf(!configuredIds.has(connectorId))(
        'pushFinding returns a vendor reference',
        async () => {
          const connector = await initConnector(connectorId);
          const finding = sampleFindingForConnector(connectorId, accountId);
          const result = await connector.pushFinding(finding);

          expect(result.ok, result.error ?? 'push failed').toBe(true);
          expect(result.pushedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          expect(result.vendorId).toBeTruthy();
          expect(result.vendorId).not.toBe('skipped');
          expect(result.vendorId).not.toBe('skipped-alert');
          expect(result.vendorId).not.toBe('skipped-severity');

          console.info(
            `[live:${connectorId}] push ok vendorId=${result.vendorId}` +
            (result.vendorUrl ? ` url=${result.vendorUrl}` : ''),
          );
        },
        LIVE_TEST_TIMEOUT_MS,
      );
    });
  }
});

describe('connector live harness (offline)', () => {
  it('skips live suite unless SCOUT_CONNECTOR_LIVE_TESTS=true', () => {
    if (RUN_LIVE) {
      expect(liveTestsEnabled()).toBe(true);
      return;
    }
    expect(liveTestsEnabled()).toBe(false);
  });
});
