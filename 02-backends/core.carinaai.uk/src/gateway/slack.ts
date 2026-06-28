import chalk from 'chalk';
import { config } from '../config/index.js';
import { channelRegistry } from './channels/channel-registry.js';
import { SlackAdapter } from './channels/adapters/slack-adapter.js';
import {
  createAmbientSchedulerTask,
  getChannelIngestionService,
  isSlackAmbientEnabled,
} from '../agents/ambient/index.js';

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

  if (isSlackAmbientEnabled()) {
    const ingestion = getChannelIngestionService();
    ingestion.start();
    console.log(chalk.gray('[carina:ambient] Slack passive channel reading enabled'));
  }

  await adapter.start?.();
  console.log(chalk.green('Slack gateway ready'));
}

export function createSlackAmbientSchedulerTask(): ReturnType<typeof createAmbientSchedulerTask> | null {
  if (!isSlackAmbientEnabled()) return null;
  const adapter = channelRegistry.getByName('slack');
  if (!adapter) return null;

  return createAmbientSchedulerTask(async (check) => {
    await adapter.sendMessage(check.channelId, check.message, {
      threadId: undefined,
    });
  });
}
