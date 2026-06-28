import type { SlashCommand } from './registry.js';
import fs from 'node:fs/promises';
import { describePlatformToolsets } from '../../tools/toolset-config.js';
import { embeddingProviderStatus } from '../../memory/embeddings.js';

const startedAt = Date.now();

async function readFirstExisting(paths: string[]): Promise<string | null> {
  for (const file of paths) {
    try {
      const value = (await fs.readFile(file, 'utf8')).trim();
      if (value) return value;
    } catch {
      // Continue through candidate deploy marker paths.
    }
  }
  return null;
}

async function resolveDeployTimestamp(): Promise<string> {
  const envTimestamp = process.env.DEPLOY_TIMESTAMP
    ?? process.env.CARINA_DEPLOY_TIMESTAMP
    ?? process.env.SOURCE_DATE_EPOCH;
  if (envTimestamp?.trim()) return envTimestamp.trim();

  return await readFirstExisting([
    '.deploy-timestamp',
    'dist/.deploy-timestamp',
    '/app/.deploy-timestamp',
    '/home/malike/apps/core.carinaai.uk/.deploy-timestamp',
  ]) ?? 'unknown';
}

function resolveScoutStatus(): string {
  const enabled = process.env.LABYRINTH_ENABLED === 'true' || process.env.SCOUT_ENABLED === 'true';
  if (!enabled) return 'not configured';
  const hasEndpoint = Boolean(
    process.env.LABYRINTH_URL
      ?? process.env.SCOUT_URL
      ?? process.env.SCOUT_CONSOLE_URL
      ?? process.env.SCOUT_ENGINE_URL,
  );
  return hasEndpoint ? 'connected' : 'enabled';
}

function resolveEmbeddingStatus(): string {
  try {
    const status = embeddingProviderStatus();
    if (!status.active) return 'degraded (no provider configured)';
    const configured = status.configured.length > 0 ? status.configured.join(', ') : 'none';
    return `${status.active} (${status.dimensions}d, configured: ${configured})`;
  } catch {
    return 'unavailable';
  }
}

export const statusCommand: SlashCommand = {
  name: 'status',
  description: 'System health, active toolsets, uptime',
  async handler() {
    const uptimeMin = Math.floor((Date.now() - startedAt) / 60000);
    const uptimeStr = uptimeMin < 60
      ? `${uptimeMin}m`
      : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`;

    const toolsets = describePlatformToolsets('telegram');
    const toolsetSummary = toolsets.enabledToolsets.length > 0
      ? toolsets.enabledToolsets.join(', ')
      : 'none';

    return [
      'Carina status:',
      `Uptime: ${uptimeStr}`,
      `Active toolsets: ${toolsetSummary}`,
      `Active tools: ${toolsets.toolCount}`,
      `Gateway: healthy`,
      `Scout: ${resolveScoutStatus()}`,
      `Embedding: ${resolveEmbeddingStatus()}`,
      `Last deploy: ${await resolveDeployTimestamp()}`,
    ].join('\n');
  },
};
