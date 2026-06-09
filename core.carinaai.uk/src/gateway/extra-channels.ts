import chalk from 'chalk';
import express, { type Express } from 'express';
import { channelRegistry } from './channels/channel-registry.js';
import { SignalAdapter } from './channels/adapters/signal-adapter.js';
import { MatrixAdapter } from './channels/adapters/matrix-adapter.js';
import { MattermostAdapter } from './channels/adapters/mattermost-adapter.js';
import { DingTalkAdapter } from './channels/adapters/dingtalk-adapter.js';
import { FeishuChatAdapter } from './channels/adapters/feishu-chat-adapter.js';
import { WeChatAdapter } from './channels/adapters/wechat-adapter.js';
import { IMessageAdapter } from './channels/adapters/imessage-adapter.js';
import { EmailChannelAdapter } from './channels/adapters/email-channel-adapter.js';
import { getRouter } from './router.js';
import type { ChannelName } from './channels/channel-adapter.interface.js';

const EXTRA_ADAPTERS = [
  { name: 'signal' as const, env: 'SIGNAL_API_URL', factory: () => new SignalAdapter(Boolean(process.env.SIGNAL_API_URL)) },
  { name: 'matrix' as const, env: 'MATRIX_HOMESERVER_URL', factory: () => new MatrixAdapter(Boolean(process.env.MATRIX_HOMESERVER_URL)) },
  { name: 'mattermost' as const, env: 'MATTERMOST_URL', factory: () => new MattermostAdapter(Boolean(process.env.MATTERMOST_URL)) },
  { name: 'dingtalk' as const, env: 'DINGTALK_WEBHOOK_URL', factory: () => new DingTalkAdapter(Boolean(process.env.DINGTALK_WEBHOOK_URL)) },
  { name: 'feishu' as const, env: 'FEISHU_APP_ID', factory: () => new FeishuChatAdapter(Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET)) },
  { name: 'wechat' as const, env: 'WECHAT_WEBHOOK_URL', factory: () => new WeChatAdapter(Boolean(process.env.WECHAT_WEBHOOK_URL || process.env.WECHAT_CORP_ID)) },
  { name: 'imessage' as const, env: 'BLUEBUBBLES_URL', factory: () => new IMessageAdapter(Boolean(process.env.BLUEBUBBLES_URL || process.env.IMESSAGE_API_URL)) },
  { name: 'email' as const, env: 'EMAIL_CHANNEL_ENABLED', factory: () => new EmailChannelAdapter(process.env.EMAIL_CHANNEL_ENABLED === 'true') },
];

function webhookPath(channel: ChannelName): string {
  return `/webhooks/${channel}`;
}

export function registerExtraChannelAdapters(): ChannelName[] {
  const active: ChannelName[] = [];
  for (const entry of EXTRA_ADAPTERS) {
    const adapter = entry.factory();
    channelRegistry.register(adapter);
    if (adapter.enabled) {
      active.push(entry.name);
      console.log(chalk.green(`${entry.name} gateway adapter registered`));
    }
  }
  return active;
}

export function mountExtraChannelWebhooks(app: Express): void {
  const router = express.Router();

  for (const entry of EXTRA_ADAPTERS) {
    const adapter = channelRegistry.getByName(entry.name);
    if (!adapter?.enabled) continue;

    router.post(webhookPath(entry.name), express.json(), async (req, res) => {
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

      const gateway = getRouter();
      const chunks: string[] = [];
      for await (const chunk of gateway.handleInbound(entry.name, req.body)) {
        chunks.push(chunk);
      }

      const inbound = await channelRegistry.getForInbound(entry.name, req.body);
      const reply = chunks.join('');
      if (reply && inbound) {
        await adapter.sendMessage(inbound.conversationId, reply, { threadId: inbound.threadId });
      }
      res.json({ ok: true, replied: Boolean(reply) });
    });
  }

  app.use(router);
}

export async function startExtraChannels(app?: Express): Promise<void> {
  registerExtraChannelAdapters();
  if (app) mountExtraChannelWebhooks(app);
}
