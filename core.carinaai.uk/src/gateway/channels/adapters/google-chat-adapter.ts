import crypto from 'crypto';
import type {
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';
import { formatForChannel } from '../channel-formatter.js';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export class GoogleChatAdapter implements IChannelAdapter {
  readonly name = 'google-chat' as const;

  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    readonly enabled: boolean,
    private readonly verificationToken = process.env.GOOGLE_CHAT_VERIFICATION_TOKEN ?? '',
    private readonly serviceAccountJson = process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON ?? '',
  ) {}

  parseInbound(raw: unknown) {
    const payload = raw as Record<string, unknown>;
    const type = String(payload.type ?? payload.eventType ?? '');
    if (type !== 'MESSAGE' && type !== 'message') return null;

    const chat = payload.chat as Record<string, unknown> | undefined;
    const message = (payload.message ?? chat?.messageData) as Record<string, unknown> | undefined;
    const space = (payload.space ?? message?.space) as Record<string, unknown> | undefined;
    const sender = message?.sender as Record<string, unknown> | undefined;
    const text = String(message?.text ?? message?.argumentText ?? '').trim();
    const spaceName = String(space?.name ?? '');
    const senderName = String(sender?.displayName ?? sender?.name ?? '');

    if (!spaceName || !text) return null;

    return {
      id: String(message?.name ?? Date.now()),
      channel: 'google-chat' as const,
      externalUserId: String(sender?.name ?? (senderName || spaceName)),
      conversationId: spaceName,
      text,
      timestamp: new Date(),
      isDirect: false,
      isMention: true,
      isCommand: text.startsWith('/'),
      senderName,
      raw: payload,
    };
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    const token = await this.accessToken();
    if (!token) return;

    const spaceId = conversationId.startsWith('spaces/')
      ? conversationId
      : `spaces/${conversationId}`;

    for (const chunk of formatForChannel('google-chat', text)) {
      await fetch(`https://chat.googleapis.com/v1/${spaceId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('google-chat', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.verificationToken) return false;

    const auth = String(input.headers.authorization ?? '');
    if (auth === `Bearer ${this.verificationToken}`) return true;

    const body = input.body as Record<string, unknown> | undefined;
    if (body && String(body.token ?? '') === this.verificationToken) return true;

    return false;
  }

  private async accessToken(): Promise<string | null> {
    if (!this.serviceAccountJson) return null;

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }

    let sa: ServiceAccount;
    try {
      sa = JSON.parse(this.serviceAccountJson) as ServiceAccount;
    } catch {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/chat.bot',
      aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');
    const unsigned = `${header}.${claim}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(sa.private_key, 'base64url');
    const jwt = `${unsigned}.${signature}`;

    const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    this.cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
    };
    return data.access_token;
  }
}
