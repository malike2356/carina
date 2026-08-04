import { listEnabledExtensionIds, readExtensionStore } from './store.js';

export type ActiveExtensionInfo = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
};

export async function getActiveExtensions(
  _workspaceId?: string | null,
): Promise<ActiveExtensionInfo[]> {
  const ids = await listEnabledExtensionIds();
  if (ids.length === 0) return [];

  const store = await readExtensionStore();
  const byId = new Map(store.map((row) => [row.id, row]));

  return ids.map((id) => {
    const record = byId.get(id);
    return {
      id,
      name: record?.name ?? id,
      description: record?.version
        ? `Extension v${record.version} (${record.status})`
        : `Enabled extension (${record?.status ?? 'enabled'})`,
      capabilities: ['prompt_fragments', 'runtime_hooks'],
    };
  });
}
