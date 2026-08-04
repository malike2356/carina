import type { InboundMessage } from '../types.js';
import { handleParsedInbound } from '../message-router.js';

type GatewayHandle = {
  stop: () => Promise<void>;
};

const gateways = new Map<string, GatewayHandle>();

export async function resolveDiscordApplicationId(botToken: string): Promise<string> {
  const response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: { Authorization: `Bot ${botToken.trim()}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error('Invalid Discord bot token');
  }
  const data = await response.json() as { id?: string };
  if (!data.id) {
    throw new Error('Could not resolve Discord application id');
  }
  return data.id;
}

export async function ensureDiscordGateway(
  applicationId: string,
  botToken: string,
  workerId: string,
  workspaceId: string,
): Promise<void> {
  if (gateways.has(applicationId)) return;

  const discord = await import('discord.js');
  const client = new discord.Client({
    intents: [
      discord.GatewayIntentBits.DirectMessages,
      discord.GatewayIntentBits.MessageContent,
    ],
  });

  client.on('messageCreate', (message) => {
    void (async () => {
      if (message.author?.bot) return;
      if (message.channel?.type !== discord.ChannelType.DM) return;
      const content = message.content?.trim();
      if (!content) return;

      const inbound: InboundMessage = {
        channel: 'discord',
        workerId,
        workspaceId,
        contactId: message.channel.id,
        contactName: message.author.username ?? message.author.globalName ?? undefined,
        content,
        rawPayload: message,
        timestamp: message.createdAt,
        threadId: message.id,
      };
      await handleParsedInbound(inbound, applicationId);
    })().catch((err) => {
      console.error('[discord-gateway] inbound error:', err);
    });
  });

  await client.login(botToken.trim());
  gateways.set(applicationId, {
    stop: async () => {
      client.destroy();
      gateways.delete(applicationId);
    },
  });
}

export async function stopDiscordGateway(applicationId: string): Promise<void> {
  const gateway = gateways.get(applicationId);
  if (gateway) {
    await gateway.stop();
  }
}

export function listDiscordGateways(): string[] {
  return [...gateways.keys()];
}
