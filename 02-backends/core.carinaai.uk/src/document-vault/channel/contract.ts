/**
 * Reusable channel attachment and platform capability contract (prompt 713).
 */

export const CHANNEL_MATRIX: Record<
  string,
  { files: boolean; maxAttachBytes: number; slash: boolean }
> = {
  telegram: { files: true, maxAttachBytes: 20 * 1024 * 1024, slash: true },
  slack: { files: true, maxAttachBytes: 20 * 1024 * 1024, slash: true },
  teams: { files: true, maxAttachBytes: 15 * 1024 * 1024, slash: true },
  whatsapp: { files: true, maxAttachBytes: 16 * 1024 * 1024, slash: true },
  discord: { files: true, maxAttachBytes: 25 * 1024 * 1024, slash: true },
  email: { files: true, maxAttachBytes: 10 * 1024 * 1024, slash: false },
  sms: { files: false, maxAttachBytes: 0, slash: false },
  web: { files: true, maxAttachBytes: 25 * 1024 * 1024, slash: true },
};

export function channelSupportsFiles(platform: string): boolean {
  const row = CHANNEL_MATRIX[String(platform || '').trim().toLowerCase()];
  return Boolean(row?.files);
}

export function channelMaxAttachBytes(platform: string): number {
  const row = CHANNEL_MATRIX[String(platform || '').trim().toLowerCase()];
  return row?.maxAttachBytes ?? 0;
}

export type ChannelAttachment = {
  platform: string;
  channelUserId: string;
  eventId: string;
  filename: string;
  data: Buffer;
  declaredMime?: string;
  caption?: string;
  parentId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ChannelReceipt = {
  ok: boolean;
  message: string;
  itemId?: string | null;
  jobId?: string | null;
  deduplicated?: boolean;
  data?: Record<string, unknown>;
};
