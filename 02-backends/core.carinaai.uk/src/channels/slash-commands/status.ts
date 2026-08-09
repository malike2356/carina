import type { SlashCommand } from './registry.js';
import fs from 'node:fs/promises';
import { describePlatformToolsets } from '../../tools/toolset-config.js';
import { embeddingProviderStatus } from '../../memory/embeddings.js';
import { getWorkerById } from '../../workers/worker-store.js';
import { prefersTelegramVoiceReplies } from '../../gateway/telegram-audio.js';
import { getSocialSettings } from '../../ingestion/social/social-settings-store.js';
import { statusAivaConversation } from '../../memory/aiva/memory-commands.js';
import type { InboundMessage } from '../types.js';

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

function formatUptime(): string {
  const uptimeMin = Math.floor((Date.now() - startedAt) / 60000);
  if (uptimeMin < 60) return `${uptimeMin} min`;
  return `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`;
}

function wantsTechStatus(msg: InboundMessage): boolean {
  const arg = (msg.content?.trim() ?? '').split(/\s+/)[1]?.toLowerCase();
  return arg === 'tech' || arg === 'debug' || arg === 'raw';
}

async function buildFriendlyStatus(msg: InboundMessage): Promise<string> {
  const worker = await getWorkerById(msg.workerId).catch(() => null);
  const name = worker?.name?.trim() || 'Your Aiva';
  const status = worker?.status === 'active' ? 'online and ready' : (worker?.status ?? 'unavailable');
  const voiceOn = prefersTelegramVoiceReplies(worker?.workerConfig?.telegram);
  const incognitoOn = worker?.workerConfig?.privacy?.incognito === true;
  const social = await getSocialSettings(msg.workspaceId).catch(() => null);
  const convo = await statusAivaConversation({
    workspaceId: msg.workspaceId,
    workerId: msg.workerId,
    channel: msg.channel,
    contactId: msg.contactId,
  }).catch(() => null);

  const scout = resolveScoutStatus();
  const securityLine =
    scout === 'connected' || scout === 'enabled'
      ? 'Security watch: on'
      : 'Security watch: off';

  const chatLine = convo
    ? `Recent chat memory: ${convo.episodicTurns} turn${convo.episodicTurns === 1 ? '' : 's'} in this conversation`
    : 'Recent chat memory: unavailable';

  return [
    `${name} is ${status}.`,
    '',
    chatLine,
    `Voice replies: ${voiceOn ? 'on' : 'off'}  (change with /voice_on or /voice_off)`,
    `Incognito: ${incognitoOn ? 'on (chats not saved)' : 'off'}  (/incognito_on or /incognito_off)`,
    social
      ? `Chat approvals: ${social.socialRequireApproval ? 'on (drafts wait for approval)' : 'off (replies send live)'}`
      : 'Chat approvals: unavailable',
    securityLine,
    '',
      'Useful commands: /help  /config  /voice_on  /voice_off  /incognito_on  /incognito_off  /memory  /vault  /new',
    'For technical details: /status tech',
  ].join('\n');
}

async function buildTechStatus(msg: InboundMessage): Promise<string> {
  const toolsets = describePlatformToolsets('telegram');
  const toolsetSummary = toolsets.enabledToolsets.length > 0
    ? toolsets.enabledToolsets.join(', ')
    : 'none';

  const { enrichStatusWithMemory } = await import('./memory-commands.js');
  const base = [
    'Aiva status (tech):',
    `Uptime: ${formatUptime()}`,
    `Active toolsets: ${toolsetSummary}`,
    `Active tools: ${toolsets.toolCount}`,
    `Gateway: healthy`,
    `Scout: ${resolveScoutStatus()}`,
    `Embedding: ${resolveEmbeddingStatus()}`,
    `Last deploy: ${await resolveDeployTimestamp()}`,
  ].join('\n');
  return enrichStatusWithMemory(base, msg);
}

export const statusCommand: SlashCommand = {
  name: 'status',
  description: 'Is your Aiva ready? (/status tech for details)',
  async handler(msg) {
    if (wantsTechStatus(msg)) return buildTechStatus(msg);
    return buildFriendlyStatus(msg);
  },
};
