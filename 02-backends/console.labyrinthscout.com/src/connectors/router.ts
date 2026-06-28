import type { SecurityEvent } from '../alerts/types.js';
import {
  createInitializedConnector,
  loadEnabledConnectorRoutes,
  storeVendorRef,
} from '../lib/connector-config.js';
import { buildAlertFromFinding, mapSecurityEventToFinding } from './event-mapper.js';
import { meetsMinSeverity } from './severity-map.js';
import type { ScoutAlert, ScoutFinding } from './types.js';

interface ConnectorRoute {
  connectorId: string;
  findingTypes?: string[];
  minSeverity: ScoutFinding['severity'];
  routeAllAlerts: boolean;
}

export class ConnectorRouter {
  private routesByAccount = new Map<string, ConnectorRoute[]>();

  async loadRoutes(accountId: string): Promise<void> {
    const rows = await loadEnabledConnectorRoutes(accountId);
    this.routesByAccount.set(
      accountId,
      rows.map((row) => ({
        connectorId: row.connector_id,
        findingTypes: row.finding_types ?? undefined,
        minSeverity: row.min_severity,
        routeAllAlerts: row.route_alerts,
      })),
    );
  }

  async pushFinding(finding: ScoutFinding): Promise<void> {
    const routes = await this.getRoutes(finding.accountId);
    for (const route of routes) {
      if (!this.matchesFindingRoute(finding, route)) continue;
      await this.pushToConnector(route.connectorId, finding.accountId, async (connector) => {
        const result = await connector.pushFinding(finding);
        if (result.ok && result.vendorId && result.vendorId !== 'skipped') {
          await storeVendorRef({
            scoutFindingId: finding.id,
            connectorId: route.connectorId,
            accountId: finding.accountId,
            vendorId: result.vendorId,
            vendorUrl: result.vendorUrl,
          });
        }
        return result;
      });
    }
  }

  async pushAlert(alert: ScoutAlert, accountId: string): Promise<void> {
    const routes = await this.getRoutes(accountId);
    for (const route of routes) {
      if (!route.routeAllAlerts) continue;
      await this.pushToConnector(route.connectorId, accountId, async (connector) => {
        const result = await connector.pushAlert(alert);
        if (result.ok && result.vendorId && result.vendorId !== 'skipped') {
          await storeVendorRef({
            scoutFindingId: alert.findingId,
            connectorId: route.connectorId,
            accountId,
            vendorId: result.vendorId,
            vendorUrl: result.vendorUrl,
          });
        }
        return result;
      });
    }
  }

  async pushFromSecurityEvent(
    event: SecurityEvent,
    accountId: string,
    metadata: Record<string, unknown> = {},
    opts?: { pushAlert?: boolean },
  ): Promise<void> {
    const finding = mapSecurityEventToFinding(event, accountId, metadata);
    await this.pushFinding(finding);
    if (opts?.pushAlert) {
      await this.pushAlert(buildAlertFromFinding(finding), accountId);
    }
  }

  private async getRoutes(accountId: string): Promise<ConnectorRoute[]> {
    if (!this.routesByAccount.has(accountId)) {
      await this.loadRoutes(accountId);
    }
    return this.routesByAccount.get(accountId) ?? [];
  }

  private matchesFindingRoute(finding: ScoutFinding, route: ConnectorRoute): boolean {
    if (route.findingTypes && !route.findingTypes.includes(finding.type)) {
      return false;
    }
    return meetsMinSeverity(finding.severity, route.minSeverity);
  }

  private async pushToConnector(
    connectorId: string,
    accountId: string,
    action: (connector: import('./types.js').SiemConnector) => Promise<{ ok: boolean; error?: string }>,
  ): Promise<void> {
    let initialized: Awaited<ReturnType<typeof createInitializedConnector>> | null = null;
    try {
      initialized = await createInitializedConnector(accountId, connectorId);
      if (!initialized) return;
      const result = await action(initialized.connector);
      if (!result.ok && result.error) {
        console.error(`[connector] ${connectorId} push failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`[connector] ${connectorId} push failed:`, err);
    } finally {
      if (initialized?.connector) {
        await initialized.connector.shutdown().catch(() => undefined);
      }
    }
  }
}

let routerSingleton: ConnectorRouter | null = null;

export function getConnectorRouter(): ConnectorRouter {
  if (!routerSingleton) routerSingleton = new ConnectorRouter();
  return routerSingleton;
}

export function resetConnectorRouter(): void {
  routerSingleton = null;
}
