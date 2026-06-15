import { registry } from '../tools/registry.js';
import { extensionToolNames } from './tools.js';
import { listRegisteredExtensionHooks } from './hooks-loader.js';
import { extensionMcpServerNames, listExtensionsWithMcp } from './mcp-loader.js';

export type ExtensionConflict = {
  kind: 'tool' | 'hook' | 'mcp';
  name: string;
  existingOwner: string;
  incomingOwner: string;
};

export function detectExtensionConflicts(
  incomingId: string,
  options: {
    toolNames?: string[];
    hooks?: string[];
    mcpServers?: string[];
  },
): ExtensionConflict[] {
  const conflicts: ExtensionConflict[] = [];
  const toolNames = options.toolNames ?? [];

  for (const name of toolNames) {
    const existing = registry.get(name);
    if (existing && !name.startsWith(`ext_${incomingId.replace(/-/g, '_')}_`)) {
      conflicts.push({
        kind: 'tool',
        name,
        existingOwner: 'core',
        incomingOwner: incomingId,
      });
    }
  }

  for (const [extId, names] of listExtensionToolOwners()) {
    if (extId === incomingId) continue;
    for (const name of toolNames) {
      if (names.includes(name)) {
        conflicts.push({
          kind: 'tool',
          name,
          existingOwner: extId,
          incomingOwner: incomingId,
        });
      }
    }
  }

  const hookNames = options.hooks ?? [];
  for (const hook of hookNames) {
    for (const reg of listRegisteredExtensionHooks()) {
      if (reg.extensionId === incomingId) continue;
      if (reg.hook === hook) {
        conflicts.push({
          kind: 'hook',
          name: hook,
          existingOwner: reg.extensionId,
          incomingOwner: incomingId,
        });
      }
    }
  }

  const mcpNames = options.mcpServers ?? [];
  for (const name of mcpNames) {
    for (const [extId, servers] of listExtensionMcpOwners()) {
      if (extId === incomingId) continue;
      if (servers.includes(name)) {
        conflicts.push({
          kind: 'mcp',
          name,
          existingOwner: extId,
          incomingOwner: incomingId,
        });
      }
    }
  }

  return conflicts;
}

function listExtensionToolOwners(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const tool of registry.list()) {
    const match = /^ext_([a-z0-9_]+)_/.exec(tool.name);
    if (!match) continue;
    const extId = match[1]!.replace(/_/g, '-');
    const list = map.get(extId) ?? [];
    list.push(tool.name);
    map.set(extId, list);
  }
  return map;
}

function listExtensionMcpOwners(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const id of listExtensionsWithMcp()) {
    const servers = extensionMcpServerNames(id);
    if (servers.length > 0) map.set(id, servers);
  }
  return map;
}

export function formatExtensionConflicts(conflicts: ExtensionConflict[]): string {
  return conflicts
    .map((c) => `${c.kind} "${c.name}" owned by ${c.existingOwner}, conflicts with ${c.incomingOwner}`)
    .join('; ');
}

export function previewExtensionToolNames(id: string, toolNames: string[]): string[] {
  const prefix = `ext_${id.replace(/-/g, '_')}_`;
  return toolNames.map((n) => (n.startsWith(prefix) ? n : `${prefix}${n}`));
}

export function listExtensionToolNamesForId(id: string): string[] {
  return extensionToolNames(id);
}
