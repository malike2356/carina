import type {
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';
import { formatForChannel } from '../channel-formatter.js';
import { decodeJwtPayload } from './webhook-signature.js';

export function validateTeamsJwt(token: string, appId: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  const aud = String(payload.aud ?? '');
  if (appId && aud && aud !== appId) return false;

  const exp = Number(payload.exp ?? 0);
  if (exp && exp < Math.floor(Date.now() / 1000)) return false;

  return true;
}

export class TeamsAdapter implements IChannelAdapter {
  readonly name = 'teams' as const;

  private readonly serviceUrls = new Map<string, string>();
  private cachedBotToken: { value: string; expiresAt: number } | null = null;

  constructor(
    readonly enabled: boolean,
    private readonly appId = process.env.TEAMS_APP_ID ?? '',
    private readonly appPassword = process.env.TEAMS_APP_PASSWORD ?? '',
    private readonly tenantId = process.env.TEAMS_TENANT_ID ?? 'botframework.com',
  ) {}

  parseInbound(raw: unknown) {
    const activity = raw as Record<string, unknown>;
    if (String(activity.type ?? '') !== 'message') return null;

    const text = String(activity.text ?? '').trim();
    const from = activity.from as Record<string, unknown> | undefined;
    const conversation = activity.conversation as Record<string, unknown> | undefined;
    const conversationId = String(conversation?.id ?? '');
    const serviceUrl = String(activity.serviceUrl ?? '');

    if (!conversationId || !text) return null;
    if (serviceUrl) {
      this.serviceUrls.set(conversationId, serviceUrl.replace(/\/$/, ''));
    }

    return {
      id: String(activity.id ?? Date.now()),
      channel: 'teams' as const,
      externalUserId: String(from?.id ?? ''),
      conversationId,
      text,
      timestamp: new Date(),
      isDirect: String(conversation?.conversationType ?? '') === 'personal',
      isMention: true,
      isCommand: text.startsWith('/'),
      senderName: String(from?.name ?? ''),
      teamId: String(conversation?.tenantId ?? ''),
      raw: activity,
    };
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    const serviceUrl = this.serviceUrls.get(conversationId);
    const token = await this.botAccessToken();
    if (!serviceUrl || !token) return;

    for (const chunk of formatForChannel('teams', text)) {
      await fetch(`${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          text: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('teams', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.appId || !this.appPassword) return false;

    const auth = String(input.headers.authorization ?? '');
    if (!auth.startsWith('Bearer ')) return false;

    const token = auth.slice(7).trim();
    return validateTeamsJwt(token, this.appId);
  }

  private async botAccessToken(): Promise<string | null> {
    if (!this.appId || !this.appPassword) return null;

    if (this.cachedBotToken && this.cachedBotToken.expiresAt > Date.now() + 60_000) {
      return this.cachedBotToken.value;
    }

    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.appId,
        client_secret: this.appPassword,
        scope: 'https://api.botframework.com/.default',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    this.cachedBotToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
    };
    return data.access_token;
  }
}
