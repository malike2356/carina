import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';

export type AivaChannelConnectionStatus =
  | 'disconnected'
  | 'oauth_pending'
  | 'connected'
  | 'token_expired'
  | string;

export interface AivaChannelCard {
  id: string;
  type: string;
  label: string;
  identifier: string | null;
  active: boolean;
  connected: boolean;
  verified: boolean;
  connectionStatus: AivaChannelConnectionStatus;
}

export interface AivaChannelsListResponse {
  channels: AivaChannelCard[];
  planTier: string | null;
  channelLimit: number | null;
  connectedCount: number;
}

export interface AivaChannelField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  required?: boolean;
}

/** Token/credential channels fully supported in the mobile app. */
export const MOBILE_SUPPORTED_CHANNEL_TYPES = [
  'telegram',
  'email',
  'slack',
  'web',
  'whatsapp',
  'sms',
  'discord',
  'teams',
] as const;

export type MobileSupportedChannelType = (typeof MOBILE_SUPPORTED_CHANNEL_TYPES)[number];

export const MOBILE_CHANNEL_FIELDS: Record<string, AivaChannelField[]> = {
  telegram: [
    {
      key: 'bot_token',
      label: 'Bot token',
      placeholder: 'From @BotFather',
      secret: true,
      required: true,
    },
  ],
  slack: [
    {
      key: 'bot_token',
      label: 'Bot token',
      placeholder: 'xoxb-...',
      secret: true,
      required: true,
    },
    {
      key: 'team_id',
      label: 'Team ID',
      placeholder: 'T...',
      required: true,
    },
  ],
  whatsapp: [
    {
      key: 'access_token',
      label: 'Access token',
      placeholder: 'Permanent system user token',
      secret: true,
      required: true,
    },
    {
      key: 'phone_number_id',
      label: 'Phone number ID',
      placeholder: 'From Meta WhatsApp dashboard',
      required: true,
    },
  ],
  sms: [
    {
      key: 'account_sid',
      label: 'Account SID',
      placeholder: 'AC...',
      required: true,
    },
    {
      key: 'auth_token',
      label: 'Auth token',
      placeholder: 'From Twilio console',
      secret: true,
      required: true,
    },
    {
      key: 'from_number',
      label: 'From number',
      placeholder: '+447700900000',
      required: true,
    },
  ],
  discord: [
    {
      key: 'bot_token',
      label: 'Bot token',
      placeholder: 'From Discord developer portal',
      secret: true,
      required: true,
    },
  ],
  teams: [
    {
      key: 'app_id',
      label: 'Microsoft App ID',
      placeholder: 'Azure Bot application ID',
      required: true,
    },
    {
      key: 'app_password',
      label: 'Client secret',
      placeholder: 'Azure client secret',
      secret: true,
      required: true,
    },
    {
      key: 'tenant_id',
      label: 'Tenant ID (optional)',
      placeholder: 'botframework.com or tenant UUID',
      required: false,
    },
  ],
  web: [],
  email: [
    {
      key: 'from_address',
      label: 'Inbound address (optional)',
      placeholder: 'Auto-generated if empty',
      required: false,
    },
  ],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function isMobileSupportedChannelType(type: string): boolean {
  return (MOBILE_SUPPORTED_CHANNEL_TYPES as readonly string[]).includes(type);
}

export function parseAivaChannelCard(raw: unknown): AivaChannelCard | null {
  const row = asRecord(raw);
  if (!row) return null;
  const type = asString(row.type ?? row.channel);
  if (!type) return null;
  const id = asString(row.id, type);
  return {
    id,
    type,
    label: asString(row.label, type),
    identifier:
      typeof row.identifier === 'string' && row.identifier.trim()
        ? row.identifier
        : null,
    active: Boolean(row.active ?? row.enabled),
    connected: Boolean(row.connected),
    verified: Boolean(row.verified),
    connectionStatus: asString(row.connectionStatus, 'disconnected'),
  };
}

export function parseAivaChannelsList(payload: unknown): AivaChannelsListResponse {
  const root = asRecord(payload) ?? {};
  const list = Array.isArray(root.channels) ? root.channels : [];
  const channels = list
    .map((item) => parseAivaChannelCard(item))
    .filter((item): item is AivaChannelCard => item !== null);
  return {
    channels,
    planTier: typeof root.planTier === 'string' ? root.planTier : null,
    channelLimit: typeof root.channelLimit === 'number' ? root.channelLimit : null,
    connectedCount:
      typeof root.connectedCount === 'number'
        ? root.connectedCount
        : channels.filter((c) => c.connected).length,
  };
}

export interface ConnectChannelPayload {
  workerId: string;
  channel: string;
  credentials: Record<string, string>;
  identifier?: string;
}

export function buildConnectChannelPayload(
  workerId: string,
  channelType: string,
  values: Record<string, string>,
): ConnectChannelPayload {
  const fields = MOBILE_CHANNEL_FIELDS[channelType] ?? [];
  const credentials: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.key]?.trim();
    if (value) credentials[field.key] = value;
  }

  const payload: ConnectChannelPayload = {
    workerId,
    channel: channelType,
    credentials,
  };

  const identifier = values.identifier?.trim();
  if (identifier) {
    payload.identifier = identifier;
  }

  return payload;
}

export function validateConnectChannelValues(
  channelType: string,
  values: Record<string, string>,
): string | null {
  if (!isMobileSupportedChannelType(channelType)) {
    return 'This channel type is not available in the mobile app yet.';
  }
  if (channelType === 'web' || channelType === 'email') {
    return null;
  }
  const fields = MOBILE_CHANNEL_FIELDS[channelType] ?? [];
  for (const field of fields) {
    if (field.required === false) continue;
    if (!values[field.key]?.trim()) {
      return `${field.label} is required.`;
    }
  }
  return null;
}

async function channelsRequest<T>(
  baseUrl: string,
  path: string,
  auth: GatewayAuthOptions | undefined,
  init: RequestInit | undefined,
  label: string,
  parse: (payload: unknown) => T,
): Promise<T> {
  const response = await fetch(
    buildAivaUrl(baseUrl, path),
    mergeGatewayInit(auth, {
      method: 'GET',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    }),
  );
  const text = await response.text();
  if (!response.ok) {
    throw formatAivaApiError(label, response.status, text, response.statusText);
  }
  if (!text.trim()) {
    throw new AivaApiError(response.status, `${label}: empty response`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new AivaApiError(response.status, `${label}: server returned non-JSON body`, {
      body: text,
    });
  }
  return parse(payload);
}

export function listAivaWorkerChannels(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaChannelsListResponse> {
  return channelsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/channels`,
    auth,
    undefined,
    'Aiva channels',
    parseAivaChannelsList,
  );
}

export function connectAivaChannel(
  baseUrl: string,
  payload: ConnectChannelPayload,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return channelsRequest(
    baseUrl,
    '/api/channels',
    auth,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Aiva connect channel',
    (raw) => {
      const root = asRecord(raw);
      if (root?.error) {
        throw new AivaApiError(400, String(root.error));
      }
      return { ok: true };
    },
  );
}

export function setAivaChannelActive(
  baseUrl: string,
  workerId: string,
  channelId: string,
  active: boolean,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean; active: boolean }> {
  return channelsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/channels/${encodeURIComponent(channelId)}`,
    auth,
    {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    },
    'Aiva channel update',
    (raw) => {
      const root = asRecord(raw) ?? {};
      return { ok: root.ok !== false, active: Boolean(root.active ?? active) };
    },
  );
}

export function disconnectAivaChannel(
  baseUrl: string,
  workerId: string,
  channelId: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return channelsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/channels/${encodeURIComponent(channelId)}`,
    auth,
    { method: 'DELETE' },
    'Aiva disconnect channel',
    (raw) => {
      const root = asRecord(raw);
      return { ok: root?.ok === false ? false : true };
    },
  );
}

export async function fetchEmailOAuthAuthUrl(
  baseUrl: string,
  provider: 'gmail' | 'outlook',
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<string> {
  const data = await channelsRequest<{ authUrl?: string; error?: string }>(
    baseUrl,
    `/api/aiva/email/oauth/${provider}/auth-url?workerId=${encodeURIComponent(workerId)}`,
    auth,
    undefined,
    `Aiva ${provider} OAuth`,
    (raw) => asRecord(raw) as { authUrl?: string; error?: string },
  );
  if (!data.authUrl) {
    throw new AivaApiError(500, data.error ?? `No ${provider} auth URL returned`);
  }
  return data.authUrl;
}

export function catalogChannelsForConnect(
  channels: AivaChannelCard[],
): AivaChannelCard[] {
  return channels.filter(
    (channel) =>
      isMobileSupportedChannelType(channel.type) &&
      !channel.connected &&
      channel.connectionStatus !== 'oauth_pending',
  );
}

export function connectedChannels(
  channels: AivaChannelCard[],
): AivaChannelCard[] {
  return channels.filter(
    (channel) =>
      channel.connected ||
      channel.connectionStatus === 'oauth_pending' ||
      channel.connectionStatus === 'token_expired',
  );
}
