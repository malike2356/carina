import chalk from 'chalk';
import express, { type Express, type Request, type Response } from 'express';
import { channelRegistry } from './channels/channel-registry.js';
import type { ChannelName, IChannelAdapter } from './channels/channel-adapter.interface.js';
import { SignalAdapter } from './channels/adapters/signal-adapter.js';
import { MatrixAdapter } from './channels/adapters/matrix-adapter.js';
import { MattermostAdapter } from './channels/adapters/mattermost-adapter.js';
import { DingTalkAdapter } from './channels/adapters/dingtalk-adapter.js';
import { FeishuChatAdapter } from './channels/adapters/feishu-chat-adapter.js';
import { WeChatAdapter } from './channels/adapters/wechat-adapter.js';
import { IMessageAdapter } from './channels/adapters/imessage-adapter.js';
import { EmailChannelAdapter } from './channels/adapters/email-channel-adapter.js';
import { HomeAssistantChannelAdapter } from './channels/adapters/homeassistant-channel-adapter.js';
import { ApiServerAdapter } from './channels/adapters/api-server-adapter.js';
import { WebhookChannelAdapter } from './channels/adapters/webhook-channel-adapter.js';
import { IrcAdapter } from './channels/adapters/irc-adapter.js';
import { LineAdapter } from './channels/adapters/line-adapter.js';
import { ViberAdapter } from './channels/adapters/viber-adapter.js';
import { GoogleChatAdapter } from './channels/adapters/google-chat-adapter.js';
import { TeamsAdapter } from './channels/adapters/teams-adapter.js';
import { NtfyAdapter } from './channels/adapters/ntfy-adapter.js';
import { PushoverAdapter } from './channels/adapters/pushover-adapter.js';
import { GotifyAdapter } from './channels/adapters/gotify-adapter.js';
import { MessengerAdapter } from './channels/adapters/messenger-adapter.js';
import { InstagramAdapter } from './channels/adapters/instagram-adapter.js';
import { TwitterAdapter } from './channels/adapters/twitter-adapter.js';
import { RocketChatAdapter } from './channels/adapters/rocketchat-adapter.js';
import { WebexAdapter } from './channels/adapters/webex-adapter.js';
import { KakaoTalkAdapter } from './channels/adapters/kakaotalk-adapter.js';
import { ZaloAdapter } from './channels/adapters/zalo-adapter.js';
import { ThreemaAdapter } from './channels/adapters/threema-adapter.js';
import { WireAdapter } from './channels/adapters/wire-adapter.js';
import { KeybaseAdapter } from './channels/adapters/keybase-adapter.js';
import { TwitchAdapter } from './channels/adapters/twitch-adapter.js';
import { YoutubeAdapter } from './channels/adapters/youtube-adapter.js';
import { GroupMeAdapter } from './channels/adapters/groupme-adapter.js';
import { NextcloudTalkAdapter } from './channels/adapters/nextcloud-talk-adapter.js';
import { LinkedInAdapter } from './channels/adapters/linkedin-adapter.js';
import { SmsAdapter } from './channels/adapters/sms-adapter.js';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import { getChannelStatusReports } from './channels/channel-status.js';
import { isSmsConfigured } from './sms.js';
import { isIrcConfigured, isIrcLiveEnabled } from './irc.js';

type AdapterFactory = {
  name: ChannelName;
  factory: () => IChannelAdapter;
};

const REST_ADAPTERS: AdapterFactory[] = [
  {
    name: 'signal',
    factory: () => new SignalAdapter(Boolean(process.env.SIGNAL_API_URL)),
  },
  {
    name: 'matrix',
    factory: () => new MatrixAdapter(Boolean(process.env.MATRIX_HOMESERVER_URL && process.env.MATRIX_ACCESS_TOKEN)),
  },
  {
    name: 'mattermost',
    factory: () => new MattermostAdapter(Boolean(process.env.MATTERMOST_URL && process.env.MATTERMOST_TOKEN)),
  },
  {
    name: 'dingtalk',
    factory: () => new DingTalkAdapter(Boolean(process.env.DINGTALK_WEBHOOK_URL || process.env.DINGTALK_APP_KEY)),
  },
  {
    name: 'feishu',
    factory: () => new FeishuChatAdapter(Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET)),
  },
  {
    name: 'wechat',
    factory: () => new WeChatAdapter(Boolean(
      process.env.WECHAT_WEBHOOK_URL || process.env.WECHAT_CORP_ID,
    )),
  },
  {
    name: 'imessage',
    factory: () => new IMessageAdapter(Boolean(
      process.env.BLUEBUBBLES_URL || process.env.IMESSAGE_API_URL,
    )),
  },
  {
    name: 'email',
    factory: () => new EmailChannelAdapter(process.env.EMAIL_CHANNEL_ENABLED === 'true'),
  },
  {
    name: 'homeassistant',
    factory: () => new HomeAssistantChannelAdapter(Boolean(
      process.env.HA_CHANNEL_ENABLED === 'true'
      || (process.env.HOMEASSISTANT_URL && process.env.HOMEASSISTANT_TOKEN),
    )),
  },
  {
    name: 'api',
    factory: () => new ApiServerAdapter(
      process.env.API_CHANNEL_ENABLED === 'true' || Boolean(process.env.API_CHANNEL_API_KEY || process.env.CARINA_API_KEY),
    ),
  },
  {
    name: 'webhooks',
    factory: () => new WebhookChannelAdapter(process.env.WEBHOOK_CHANNEL_ENABLED === 'true'),
  },
  {
    name: 'line',
    factory: () => new LineAdapter(Boolean(
      process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN,
    )),
  },
  {
    name: 'viber',
    factory: () => new ViberAdapter(Boolean(process.env.VIBER_AUTH_TOKEN)),
  },
  {
    name: 'google-chat',
    factory: () => new GoogleChatAdapter(Boolean(process.env.GOOGLE_CHAT_VERIFICATION_TOKEN)),
  },
  {
    name: 'teams',
    factory: () => new TeamsAdapter(Boolean(
      process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD,
    )),
  },
  {
    name: 'ntfy',
    factory: () => new NtfyAdapter(Boolean(config.ntfy.topic)),
  },
  {
    name: 'pushover',
    factory: () => new PushoverAdapter(Boolean(config.pushover.token && config.pushover.user)),
  },
  {
    name: 'gotify',
    factory: () => new GotifyAdapter(Boolean(config.gotify.url && config.gotify.token)),
  },
  {
    name: 'messenger',
    factory: () => new MessengerAdapter(Boolean(
      config.messenger.pageAccessToken
      && config.messenger.verifyToken
      && config.messenger.appSecret,
    )),
  },
  {
    name: 'instagram',
    factory: () => new InstagramAdapter(Boolean(
      config.instagram.accessToken
      && config.instagram.verifyToken
      && config.instagram.appSecret,
    )),
  },
  {
    name: 'twitter',
    factory: () => new TwitterAdapter(Boolean(
      config.twitter.apiKey
      && config.twitter.apiSecret
      && config.twitter.accessToken
      && config.twitter.accessTokenSecret
      && config.twitter.consumerSecret,
    )),
  },
  {
    name: 'rocketchat',
    factory: () => new RocketChatAdapter(Boolean(
      config.rocketchat.url
      && config.rocketchat.botUserId
      && config.rocketchat.botAuthToken,
    )),
  },
  {
    name: 'webex',
    factory: () => new WebexAdapter(Boolean(config.webex.botToken)),
  },
  {
    name: 'kakaotalk',
    factory: () => new KakaoTalkAdapter(Boolean(
      config.kakaotalk.apiKey && config.kakaotalk.botId,
    )),
  },
  {
    name: 'zalo',
    factory: () => new ZaloAdapter(Boolean(
      config.zalo.appId && config.zalo.oaAccessToken,
    )),
  },
  {
    name: 'threema',
    factory: () => new ThreemaAdapter(Boolean(
      config.threema.gatewayId && config.threema.gatewaySecret,
    )),
  },
  {
    name: 'wire',
    factory: () => new WireAdapter(Boolean(
      config.wire.botClientId && config.wire.botToken,
    )),
  },
  {
    name: 'keybase',
    factory: () => new KeybaseAdapter(Boolean(
      config.keybase.username && config.keybase.paperkey,
    )),
  },
  {
    name: 'twitch',
    factory: () => new TwitchAdapter(Boolean(
      config.twitch.clientId
      && config.twitch.clientSecret
      && config.twitch.eventsubSecret
      && config.twitch.channelId,
    )),
  },
  {
    name: 'youtube',
    factory: () => new YoutubeAdapter(Boolean(
      config.youtube.apiKey && config.youtube.liveChatId,
    )),
  },
  {
    name: 'groupme',
    factory: () => new GroupMeAdapter(Boolean(config.groupme.botId)),
  },
  {
    name: 'nextcloud-talk',
    factory: () => new NextcloudTalkAdapter(Boolean(
      config.nextcloudTalk.url && config.nextcloudTalk.botSecret,
    )),
  },
  {
    name: 'linkedin',
    factory: () => new LinkedInAdapter(Boolean(config.linkedin.accessToken)),
  },
];

const listenerHandles: Array<{ stop: () => void }> = [];

function webhookPath(channel: ChannelName): string {
  return `/webhooks/${channel}`;
}

export function registerAllChannelAdapters(): ChannelName[] {
  const active: ChannelName[] = [];

  if (isSmsConfigured()) {
    channelRegistry.register(new SmsAdapter(true));
    active.push('sms');
    console.log(chalk.green('sms gateway adapter registered'));
  }

  if (isIrcConfigured()) {
    channelRegistry.register(new IrcAdapter(true));
    active.push('irc');
    console.log(chalk.green(
      `irc gateway adapter registered (${isIrcLiveEnabled() ? 'live client' : 'webhook-only'})`,
    ));
  }

  for (const entry of REST_ADAPTERS) {
    const adapter = entry.factory();
    channelRegistry.register(adapter);
    if (adapter.enabled) {
      active.push(entry.name);
      console.log(chalk.green(`${entry.name} gateway adapter registered`));
    }
  }

  return active;
}

async function handleInboundWebhook(
  channel: ChannelName,
  adapter: IChannelAdapter,
  body: unknown,
  res: Response,
): Promise<void> {
  const gateway = getRouter();
  const chunks: string[] = [];
  for await (const chunk of gateway.handleInbound(channel, body)) {
    chunks.push(chunk);
  }

  const inbound = await channelRegistry.getForInbound(channel, body);
  const reply = chunks.join('');

  if (channel === 'api' && adapter instanceof ApiServerAdapter && inbound) {
    res.json({
      ok: true,
      conversation_id: inbound.conversationId,
      reply: adapter.drainReply(inbound.conversationId) || reply,
    });
    return;
  }

  if (reply && inbound) {
    await adapter.sendMessage(inbound.conversationId, reply, { threadId: inbound.threadId });
  }

  res.json({ ok: true, replied: Boolean(reply), reply: reply || undefined });
}

export function mountAllChannelWebhooks(app: Express): void {
  const router = express.Router();

  if (isSmsConfigured()) {
    const sms = channelRegistry.getByName('sms');
    if (sms?.enabled) {
      router.post('/sms', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const valid = await sms.validateWebhook?.({
          headers: req.headers,
          body: req.body,
          url,
          method: req.method,
        });
        if (!valid) {
          res.status(403).send('Invalid signature');
          return;
        }
        try {
          const inbound = await Promise.resolve(sms.parseInbound(req.body));
          if (!inbound) {
            res.type('text/xml').send('<Response></Response>');
            return;
          }
          const gateway = getRouter();
          const chunks: string[] = [];
          for await (const chunk of gateway.handleInbound('sms', req.body)) {
            chunks.push(chunk);
          }
          const reply = chunks.join('');
          if (reply) await sms.sendMessage(inbound.conversationId, reply);
          res.type('text/xml').send('<Response></Response>');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          res.status(500).send(msg);
        }
      });
    }
  }

  router.post('/api/message', express.json(), async (req: Request, res: Response) => {
    const adapter = channelRegistry.getByName('api');
    if (!adapter?.enabled || !(adapter instanceof ApiServerAdapter)) {
      res.status(404).json({ error: 'API channel not enabled' });
      return;
    }
    if (!adapter.validateApiKey(req.headers as Record<string, string | string[] | undefined>)) {
      res.status(401).json({ error: 'invalid api key' });
      return;
    }
    await handleInboundWebhook('api', adapter, req.body, res);
  });

  for (const entry of REST_ADAPTERS) {
    const adapter = channelRegistry.getByName(entry.name);
    if (!adapter?.enabled) continue;

    if (adapter.createRouter) {
      router.use(`/${entry.name}`, adapter.createRouter());
      continue;
    }

    router.post(webhookPath(entry.name), express.json(), async (req: Request, res: Response) => {
      if (adapter.validateWebhook) {
        const ok = await adapter.validateWebhook({
          headers: req.headers as Record<string, string | string[] | undefined>,
          body: req.body,
          rawBody: JSON.stringify(req.body),
          url: req.url,
          method: req.method,
        });
        if (!ok) {
          res.status(401).json({ error: 'invalid webhook' });
          return;
        }
      }

      try {
        await handleInboundWebhook(entry.name, adapter, req.body, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
    });
  }

  if (isIrcConfigured()) {
    const irc = channelRegistry.getByName('irc');
    if (irc?.enabled) {
      router.post('/irc', express.json(), async (req: Request, res: Response) => {
        try {
          await handleInboundWebhook('irc', irc, req.body, res);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          res.status(500).json({ error: msg });
        }
      });
    }
  }

  app.use('/webhooks', router);
}

export async function startChannelListeners(): Promise<void> {
  const irc = channelRegistry.getByName('irc');
  if (irc?.enabled && irc.start) {
    const handle = await irc.start();
    if (handle) listenerHandles.push(handle);
  }

  for (const entry of REST_ADAPTERS) {
    const adapter = channelRegistry.getByName(entry.name);
    if (!adapter?.enabled || !adapter.start) continue;
    const handle = await adapter.start();
    if (handle) listenerHandles.push(handle);
  }
}

export function stopChannelListeners(): void {
  for (const handle of listenerHandles) {
    handle.stop();
  }
  listenerHandles.length = 0;
}

export function logChannelStatus(): void {
  const reports = getChannelStatusReports().filter((r) => r.active || r.state === 'connected' || r.state === 'partial');
  const active = channelRegistry.listActive();
  console.log(chalk.gray(`Gateway channels active (${active.length}): ${active.join(', ') || 'none'}`));
  for (const r of reports) {
    if (r.webhook) console.log(chalk.gray(`  POST ${r.webhook} (${r.channel}: ${r.state})`));
  }
  const partial = getChannelStatusReports().filter((r) => r.state === 'partial' || r.state === 'disabled');
  if (partial.length) {
    console.log(chalk.gray(`  Run: carina channels status (${partial.length} configured or pending)`));
  }
}
