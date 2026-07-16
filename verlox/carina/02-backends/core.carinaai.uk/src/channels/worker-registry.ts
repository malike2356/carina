import { decryptCredentials } from './credential-store.js';
import { listEnabledChannelRows, readChannelCredentials } from './channel-store.js';
import {
  ensureDiscordGateway,
  stopDiscordGateway,
} from './adapters/discord-gateway.js';

export interface RegistryEntry {
  workerId: string;
  workspaceId: string;
  channelRowId: string;
  credentialBlob: string;
}

const registry = new Map<string, RegistryEntry>();

function registryKey(channel: string, identifier: string): string {
  return `${channel}:${identifier}`;
}

export async function rebuildRegistry(): Promise<void> {
  const rows = await listEnabledChannelRows();
  registry.clear();
  for (const row of rows) {
    registry.set(registryKey(row.channel, row.identifier), {
      workerId: row.workerId,
      workspaceId: row.workspaceId,
      channelRowId: row.id,
      credentialBlob: row.credentials.encrypted ?? '',
    });
    if (row.channel === 'discord') {
      const credentials = readChannelCredentials(row);
      if (credentials.bot_token) {
        try {
          await ensureDiscordGateway(
            row.identifier,
            credentials.bot_token,
            row.workerId,
            row.workspaceId,
          );
        } catch (err) {
          console.warn(`[worker-registry] discord gateway failed for ${row.identifier}:`, err);
        }
      }
    }
  }
}

export function lookupWorker(channel: string, identifier: string): RegistryEntry | undefined {
  return registry.get(registryKey(channel, identifier));
}

export function registerChannel(
  channel: string,
  identifier: string,
  entry: RegistryEntry,
): void {
  registry.set(registryKey(channel, identifier), entry);
  if (channel === 'discord') {
    const credentials = decryptCredentials(entry.credentialBlob);
    if (credentials.bot_token) {
      void ensureDiscordGateway(
        identifier,
        credentials.bot_token,
        entry.workerId,
        entry.workspaceId,
      ).catch((err) => {
        console.warn(`[worker-registry] discord gateway failed for ${identifier}:`, err);
      });
    }
  }
}

export function unregisterChannel(channel: string, identifier: string): void {
  registry.delete(registryKey(channel, identifier));
  if (channel === 'discord') {
    void stopDiscordGateway(identifier);
  }
}

export function getRegistryCredentials(entry: RegistryEntry): Record<string, string> {
  if (!entry.credentialBlob) return {};
  return decryptCredentials(entry.credentialBlob);
}

export { readChannelCredentials } from './channel-store.js';
