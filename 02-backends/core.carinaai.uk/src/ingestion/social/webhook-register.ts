import type { AivaChannelName } from '../../channels/types.js';
import { logChannelScoutSignal } from '../../channels/channel-scout-signals.js';
import { subscribeMetaPageWebhooks } from './meta-oauth.js';

function corePublicUrl(): string {
  return (process.env.CORE_URL ?? process.env.CARINA_CORE_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
}

export async function registerWorkerWebhook(input: {
  workerId: string;
  channel: AivaChannelName;
  credentials: Record<string, string>;
}): Promise<void> {
  const inboundUrl = `${corePublicUrl()}/api/aiva/channels/inbound/${input.channel}/${input.workerId}`;

  if (input.channel === 'messenger' || input.channel === 'instagram') {
    const pageId = input.credentials.page_id?.trim();
    const pageAccessToken = input.credentials.page_access_token?.trim();
    if (pageId && pageAccessToken) {
      await subscribeMetaPageWebhooks(pageId, pageAccessToken);
    }
  }

  if (input.channel === 'linkedin') {
    console.info(
      `[social-webhook] LinkedIn worker webhook URL (register in LinkedIn developer app if required): ${inboundUrl}`,
    );
  }

  if (input.channel === 'twitter') {
    console.info(
      `[social-webhook] X Account Activity webhook URL (register in X developer portal if required): ${inboundUrl}`,
    );
  }

  if (input.channel === 'tiktok') {
    console.info('[social-webhook] TikTok messaging webhook pending app review');
  }

  logChannelScoutSignal({
    workerId: input.workerId,
    eventType: 'social_webhook_registered',
    severity: 'info',
    description: `Registered ${input.channel} webhook target for worker`,
    metadata: { channel: input.channel, inboundUrl },
  });
}
