import { validateTeamsJwt } from '../../gateway/channels/adapters/teams-adapter.js';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

const serviceUrls = new Map<string, string>();
const tokenCache = new Map<string, { value: string; expiresAt: number }>();

export function storeTeamsServiceUrl(conversationId: string, serviceUrl: string): void {
  if (conversationId && serviceUrl) {
    serviceUrls.set(conversationId, serviceUrl.replace(/\/$/, ''));
  }
}

export function getTeamsServiceUrl(conversationId: string): string | undefined {
  return serviceUrls.get(conversationId);
}

export const teamsAdapter: ChannelAdapter = {
  channel: 'teams',

  verify(headers, _rawBody, credentials) {
    const appId = credentials?.app_id?.trim();
    const auth = String(headers.authorization ?? '');
    if (!appId || !auth.startsWith('Bearer ')) {
      return process.env.NODE_ENV !== 'production';
    }
    return validateTeamsJwt(auth.slice(7).trim(), appId);
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const activity = payload as Record<string, unknown>;
    if (String(activity.type ?? '') !== 'message') return null;

    const text = String(activity.text ?? '').trim();
    const conversation = activity.conversation as Record<string, unknown> | undefined;
    const conversationId = String(conversation?.id ?? '');
    const serviceUrl = String(activity.serviceUrl ?? '');
    if (!conversationId || !text) return null;

    if (serviceUrl) {
      storeTeamsServiceUrl(conversationId, serviceUrl);
    }

    const from = activity.from as Record<string, unknown> | undefined;

    return {
      channel: 'teams',
      workerId,
      workspaceId,
      contactId: conversationId,
      contactName: String(from?.name ?? ''),
      content: text,
      rawPayload: payload,
      timestamp: new Date(),
      threadId: String(activity.id ?? ''),
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const appId = credentials.app_id?.trim();
    const appPassword = credentials.app_password?.trim();
    const serviceUrl = getTeamsServiceUrl(message.contactId);
    if (!appId || !appPassword || !serviceUrl) {
      throw new Error('Teams credentials or conversation service URL missing');
    }

    const token = await getTeamsBotToken(appId, appPassword, credentials.tenant_id?.trim());
    if (!token) throw new Error('Teams bot token unavailable');

    const response = await fetch(
      `${serviceUrl}/v3/conversations/${encodeURIComponent(message.contactId)}/activities`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'message', text: message.content }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new Error(`Teams send failed: ${error || response.status}`);
    }
  },
};

async function getTeamsBotToken(
  appId: string,
  appPassword: string,
  tenantId?: string,
): Promise<string | null> {
  const cacheKey = `${appId}:${tenantId ?? 'botframework.com'}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.value;
  }

  const url = `https://login.microsoftonline.com/${tenantId || 'botframework.com'}/oauth2/v2.0/token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: appPassword,
      scope: 'https://api.botframework.com/.default',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  tokenCache.set(cacheKey, {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
  });
  return data.access_token;
}
