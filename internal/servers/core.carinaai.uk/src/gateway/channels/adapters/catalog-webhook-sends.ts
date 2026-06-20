import { config } from '../../../config/index.js';
import type { ChannelName } from '../channel-adapter.interface.js';
import {
  extractCallbackUrl,
  getCallbackUrl,
  type CatalogWebhookSendContext,
} from './catalog-webhook-base.js';
import { formatForChannel } from '../channel-formatter.js';

type FetchFn = typeof fetch;

async function postJson(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
}

async function postForm(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { ...headers },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
}

async function sendViaCallback(
  channel: ChannelName,
  ctx: CatalogWebhookSendContext,
  fetchImpl: FetchFn = fetch,
): Promise<boolean> {
  const callback = getCallbackUrl(channel, ctx.conversationId);
  if (!callback) return false;
  for (const chunk of formatForChannel('web', ctx.text)) {
    await postJson(callback, {
      conversation_id: ctx.conversationId,
      text: chunk,
      message: chunk,
      source: 'carina',
    }, {}, fetchImpl);
  }
  return true;
}

async function sendViaWebhookUrl(
  url: string,
  ctx: CatalogWebhookSendContext,
  bodyBuilder: (chunk: string) => Record<string, unknown>,
  headers: Record<string, string> = {},
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  if (!url.trim()) throw new Error('Webhook URL not configured');
  for (const chunk of formatForChannel('web', ctx.text)) {
    await postJson(url, bodyBuilder(chunk), headers, fetchImpl);
  }
}

let botFrameworkTokenCache: { token: string; expiresAt: number } | null = null;

async function getBotFrameworkToken(
  appId: string,
  appSecret: string,
  fetchImpl: FetchFn = fetch,
): Promise<string> {
  const now = Date.now();
  if (botFrameworkTokenCache && botFrameworkTokenCache.expiresAt > now + 60_000) {
    return botFrameworkTokenCache.token;
  }
  const res = await fetchImpl('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: appSecret,
      scope: 'https://api.botframework.com/.default',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Bot Framework token failed: HTTP ${res.status}`);
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Bot Framework token missing access_token');
  botFrameworkTokenCache = {
    token: json.access_token,
    expiresAt: now + (Number(json.expires_in ?? 3600) * 1000),
  };
  return json.access_token;
}

export function resetBotFrameworkTokenCache(): void {
  botFrameworkTokenCache = null;
}

export async function sendZulipMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { site, botEmail, apiKey } = config.zulip;
  if (!site || !botEmail || !apiKey) throw new Error('Zulip not configured');
  const base = site.replace(/\/$/, '');
  const auth = `Basic ${Buffer.from(`${botEmail}:${apiKey}`).toString('base64')}`;
  for (const chunk of formatForChannel('zulip', ctx.text)) {
    await postForm(`${base}/api/v1/messages`, {
      type: 'direct',
      to: JSON.stringify([ctx.conversationId]),
      content: chunk,
    }, { Authorization: auth }, fetchImpl);
  }
}

export async function sendRedditMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  if (await sendViaCallback('reddit', ctx, fetchImpl)) return;
  throw new Error('Reddit outbound requires reply_url/callback_url in inbound payload or a Reddit bridge sidecar');
}

export async function sendBlueskyMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { handle, appPassword, serviceUrl } = config.bluesky;
  if (!handle || !appPassword) throw new Error('Bluesky not configured');
  const base = (serviceUrl || 'https://bsky.social').replace(/\/$/, '');
  const sessionRes = await fetchImpl(`${base}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!sessionRes.ok) throw new Error(`Bluesky session failed: HTTP ${sessionRes.status}`);
  const session = await sessionRes.json() as { accessJwt?: string; did?: string };
  if (!session.accessJwt) throw new Error('Bluesky session missing accessJwt');

  for (const chunk of formatForChannel('bluesky', ctx.text)) {
    await postJson(`${base}/xrpc/chat.bsky.convo.sendMessage`, {
      convoId: ctx.conversationId,
      message: { text: chunk },
    }, { Authorization: `Bearer ${session.accessJwt}` }, fetchImpl);
  }
}

export async function sendSkypeMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { appId, appSecret, serviceUrl } = config.skype;
  if (!appId || !appSecret) throw new Error('Skype not configured');
  const token = await getBotFrameworkToken(appId, appSecret, fetchImpl);
  const base = (serviceUrl || 'https://smba.trafficmanager.net/emea').replace(/\/$/, '');
  for (const chunk of formatForChannel('skype', ctx.text)) {
    await postJson(`${base}/v3/conversations/${encodeURIComponent(ctx.conversationId)}/activities`, {
      type: 'message',
      text: chunk,
      from: { id: appId },
    }, { Authorization: `Bearer ${token}` }, fetchImpl);
  }
}

export async function sendPumbleMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  await sendViaWebhookUrl(config.pumble.webhookUrl, ctx, (chunk) => ({ text: chunk }), {}, fetchImpl);
}

export async function sendTwistMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const token = config.twist.integrationToken;
  if (!token) throw new Error('Twist not configured');
  for (const chunk of formatForChannel('twist', ctx.text)) {
    await postJson('https://api.twist.com/api/v3/threads/add_message', {
      content: chunk,
      thread_id: Number.isFinite(Number(ctx.conversationId))
        ? Number(ctx.conversationId)
        : ctx.conversationId,
    }, { Authorization: `Bearer ${token}` }, fetchImpl);
  }
}

export async function sendRyverMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  await sendViaWebhookUrl(config.ryver.webhookUrl, ctx, (chunk) => ({ body: chunk, text: chunk }), {}, fetchImpl);
}

export async function sendWorkplaceMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { pageAccessToken } = config.workplace;
  if (!pageAccessToken) throw new Error('Workplace not configured');
  for (const chunk of formatForChannel('workplace', ctx.text)) {
    await postJson(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
      recipient: { id: ctx.conversationId },
      message: { text: chunk },
    }, {}, fetchImpl);
  }
}

export async function sendNaverWorksMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { botId, botSecret, apiBase } = config.naverWorks;
  if (!botId || !botSecret) throw new Error('Naver Works not configured');
  const base = (apiBase || 'https://www.worksapis.com/v1.0').replace(/\/$/, '');
  for (const chunk of formatForChannel('naver-works', ctx.text)) {
    await postJson(`${base}/bots/${botId}/channels/${encodeURIComponent(ctx.conversationId)}/messages`, {
      content: { type: 'text', text: chunk },
    }, { Authorization: `Bearer ${botSecret}` }, fetchImpl);
  }
}

export async function sendQqMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { appId, token, apiBase } = config.qq;
  if (!appId || !token) throw new Error('QQ bot not configured');
  const base = (apiBase || 'https://api.sgroup.qq.com').replace(/\/$/, '');
  for (const chunk of formatForChannel('qq', ctx.text)) {
    await postJson(`${base}/channels/${encodeURIComponent(ctx.conversationId)}/messages`, {
      content: chunk,
      msg_type: 0,
    }, { Authorization: `Bot ${appId}.${token}` }, fetchImpl);
  }
}

export async function sendWeiboMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  if (await sendViaCallback('weibo', ctx, fetchImpl)) return;
  const { accessToken, apiBase } = config.weibo;
  if (!accessToken) throw new Error('Weibo not configured');
  const base = (apiBase || 'https://api.weibo.com/2').replace(/\/$/, '');
  for (const chunk of formatForChannel('weibo', ctx.text)) {
    await postForm(`${base}/direct_messages/new.json`, {
      text: chunk,
      receiver_id: ctx.conversationId,
      access_token: accessToken,
    }, {}, fetchImpl);
  }
}

export async function sendOpenhabMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { url, token } = config.openhab;
  if (!url) throw new Error('openHAB not configured');
  const base = url.replace(/\/$/, '');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  for (const chunk of formatForChannel('openhab', ctx.text)) {
    await postJson(`${base}/rest/notifications/push`, {
      message: chunk,
      title: 'Carina',
    }, headers, fetchImpl);
  }
}

export async function sendSynologyChatMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { webhookUrl, token } = config.synologyChat;
  const url = webhookUrl || (token ? `https://synology.local:5001/webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2&token=${token}` : '');
  if (!url) throw new Error('Synology Chat not configured');
  for (const chunk of formatForChannel('synology-chat', ctx.text)) {
    await postJson(url, { text: chunk, payload: chunk }, {}, fetchImpl);
  }
}

export async function sendGitterMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const token = config.gitter.token;
  if (!token) throw new Error('Gitter not configured');
  const roomId = ctx.conversationId;
  for (const chunk of formatForChannel('gitter', ctx.text)) {
    await postJson(`https://api.gitter.im/v1/rooms/${encodeURIComponent(roomId)}/chat`, {
      text: chunk,
    }, { Authorization: `Bearer ${token}` }, fetchImpl);
  }
}

export async function sendElementMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  await sendViaWebhookUrl(config.element.webhookUrl, ctx, (chunk) => ({
    text: chunk,
    body: chunk,
    msgtype: 'm.text',
  }), {}, fetchImpl);
}

export async function sendMastodonMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { instance, accessToken } = config.mastodon;
  if (!instance || !accessToken) throw new Error('Mastodon not configured');
  const base = instance.replace(/\/$/, '');
  for (const chunk of formatForChannel('mastodon', ctx.text)) {
    await postForm(`${base}/api/v1/statuses`, {
      status: chunk,
      visibility: 'direct',
      in_reply_to_id: ctx.options?.replyTo ?? '',
    }, { Authorization: `Bearer ${accessToken}` }, fetchImpl);
  }
}

export async function sendSnapchatMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  if (await sendViaCallback('snapchat', ctx, fetchImpl)) return;
  throw new Error('Snapchat outbound requires reply_url/callback_url in inbound payload');
}

export async function sendBridgeGenericMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const secret = config.bridgeGeneric.secret;
  if (await sendViaCallback('bridge-generic', ctx, fetchImpl)) return;
  const defaultUrl = process.env.BRIDGE_CHANNEL_CALLBACK_URL ?? '';
  if (!defaultUrl) throw new Error('bridge-generic requires callback_url in inbound payload or BRIDGE_CHANNEL_CALLBACK_URL');
  await sendViaWebhookUrl(defaultUrl, ctx, (chunk) => ({ text: chunk, message: chunk }), {
    ...(secret ? { 'X-Bridge-Secret': secret } : {}),
  }, fetchImpl);
}

export async function sendAppleBusinessChatMessage(ctx: CatalogWebhookSendContext, fetchImpl: FetchFn = fetch): Promise<void> {
  const { merchantId, apiKey, apiBase } = config.appleBusinessChat;
  if (!merchantId || !apiKey) throw new Error('Apple Business Chat not configured');
  const base = (apiBase || 'https://mspgw.push.apple.com/v1').replace(/\/$/, '');
  for (const chunk of formatForChannel('apple-business-chat', ctx.text)) {
    await postJson(`${base}/message/${merchantId}`, {
      body: chunk,
      destinationId: ctx.conversationId,
      sourceId: merchantId,
      type: 'text',
    }, { Authorization: `Bearer ${apiKey}` }, fetchImpl);
  }
}
