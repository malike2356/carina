import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class WeChatAdapter implements IChannelAdapter {
  readonly name = 'wechat' as const;

  constructor(
    readonly enabled: boolean,
    private readonly webhookUrl = process.env.WECHAT_WEBHOOK_URL ?? '',
    private readonly corpId = process.env.WECHAT_CORP_ID ?? '',
    private readonly secret = process.env.WECHAT_CORP_SECRET ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'wechat', (p) => ({
      text: String(p.Content ?? p.text ?? p.content ?? ''),
      userId: String(p.FromUserName ?? p.user_id ?? ''),
      conversationId: String(p.FromUserName ?? p.chat_id ?? 'wechat'),
      messageId: String(p.MsgId ?? ''),
      isDirect: true,
    }));
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (this.webhookUrl) {
      for (const chunk of formatForChannel('web', text)) {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgtype: 'text', text: { content: chunk } }),
        });
      }
      return;
    }

    if (!this.corpId || !this.secret) return;
    const tokenRes = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`,
    );
    const tokenData = await tokenRes.json() as { access_token?: string };
    const token = tokenData.access_token;
    if (!token) return;

    for (const chunk of formatForChannel('web', text)) {
      await fetch(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: conversationId,
          msgtype: 'text',
          agentid: Number(process.env.WECHAT_AGENT_ID ?? 0),
          text: { content: chunk },
        }),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }
}
