import chalk from 'chalk';
import { config } from '../config/index.js';
import { channelRegistry } from './channels/channel-registry.js';
import { SlackAdapter } from './channels/adapters/slack-adapter.js';

export function isSlackConfigured(): boolean {
  return Boolean(config.slack.botToken && config.slack.signingSecret);
}

export async function startSlack(): Promise<void> {
  const adapter = new SlackAdapter(isSlackConfigured());
  channelRegistry.register(adapter);

  if (!adapter.enabled) {
    console.warn(chalk.yellow('Slack gateway skipped: SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET not set'));
    return;
  }

  await adapter.start?.();
  console.log(chalk.green('Slack gateway ready'));
}
