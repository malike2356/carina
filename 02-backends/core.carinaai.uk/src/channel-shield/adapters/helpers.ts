import type { ShieldChannel, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';

export function extractLinks(text: string, html?: string): string[] {
  const hay = `${text}\n${html ?? ''}`;
  const matches = hay.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, '')))];
}

export function baseEnvelope(
  channel: ShieldChannel,
  protection: ShieldProtection,
  partial: Omit<
    ShieldEnvelope,
    'channel' | 'workspaceId' | 'protectionId' | 'links' | 'rawStorageUri' | 'receivedAt'
  > & {
    links?: string[];
    rawStorageUri?: string;
    receivedAt?: string;
  },
): ShieldEnvelope {
  const text = partial.text ?? '';
  return {
    channel,
    workspaceId: protection.workspaceId,
    protectionId: protection.id,
    externalMessageId: partial.externalMessageId,
    conversationId: partial.conversationId,
    from: partial.from,
    to: partial.to ?? [],
    subject: partial.subject,
    text,
    html: partial.html,
    links: partial.links ?? extractLinks(text, partial.html),
    attachments: partial.attachments ?? [],
    rawStorageUri: partial.rawStorageUri ?? `shield://${channel}/${protection.id}/${partial.externalMessageId}`,
    receivedAt: partial.receivedAt ?? new Date().toISOString(),
    authSignals: partial.authSignals ?? {},
    metadata: partial.metadata ?? {},
  };
}

export type IngressRequest = {
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string | Buffer;
  query?: Record<string, string>;
};

export async function defaultHealth(channel: ShieldChannel, checkEnv?: string[]): Promise<{ ok: boolean; detail: string }> {
  const missing = (checkEnv ?? []).filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    return { ok: process.env.NODE_ENV !== 'production', detail: `optional env missing: ${missing.join(',')}` };
  }
  return { ok: true, detail: `${channel} adapter ready` };
}

export function deliveryLog(
  channel: ShieldChannel,
  message: ShieldMessage,
  mode: 'deliver' | 'summary',
  extra?: Record<string, unknown>,
): void {
  console.info(`[channel-shield:${channel}] ${mode}`, {
    messageId: message.id,
    conversationId: message.envelope.conversationId,
    ...extra,
  });
}
