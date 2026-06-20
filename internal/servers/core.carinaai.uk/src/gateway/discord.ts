import chalk from 'chalk';
import { config } from '../config/index.js';
import { channelRegistry } from './channels/channel-registry.js';
import { DiscordAdapter } from './channels/adapters/discord-adapter.js';

export function isDiscordConfigured(): boolean {
  return Boolean(config.discord.botToken);
}

export async function startDiscord(): Promise<void> {
  const adapter = new DiscordAdapter(isDiscordConfigured());
  channelRegistry.register(adapter);

  if (!adapter.enabled) {
    console.warn(chalk.yellow('Discord gateway skipped: DISCORD_BOT_TOKEN not set'));
    return;
  }

  await adapter.start?.();
  console.log(chalk.green('Discord gateway ready'));
}
