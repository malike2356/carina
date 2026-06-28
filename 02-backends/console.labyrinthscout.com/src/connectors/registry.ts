import type { ConnectorDefinition, ConnectorFactory, SiemConnector } from './types.js';

const factories = new Map<string, ConnectorFactory>();

export function registerConnectorFactory(id: string, factory: ConnectorFactory): void {
  if (factories.has(id)) {
    throw new Error(`Connector ${id} already registered`);
  }
  factories.set(id, factory);
}

export function createConnector(id: string): SiemConnector | undefined {
  const factory = factories.get(id);
  return factory ? factory() : undefined;
}

export function listConnectorDefinitions(): ConnectorDefinition[] {
  return [...factories.values()].map((factory) => {
    const connector = factory();
    return {
      id: connector.id,
      name: connector.name,
      category: connector.category,
      version: connector.version,
      description: connector.description,
      configSchema: connector.configSchema,
    };
  });
}

export function listByCategory(category: string): ConnectorDefinition[] {
  return listConnectorDefinitions().filter((c) => c.category === category);
}

export function hasConnector(id: string): boolean {
  return factories.has(id);
}

export async function healthAll(
  instances: Array<{ id: string; connector: SiemConnector }>,
): Promise<Record<string, { ok: boolean; latencyMs: number; error?: string }>> {
  const results: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};
  await Promise.all(
    instances.map(async ({ id, connector }) => {
      try {
        const health = await connector.health();
        results[id] = {
          ok: health.ok,
          latencyMs: health.latencyMs,
          error: health.error,
        };
      } catch (err) {
        results[id] = {
          ok: false,
          latencyMs: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
  return results;
}

export function resetConnectorRegistry(): void {
  factories.clear();
}
