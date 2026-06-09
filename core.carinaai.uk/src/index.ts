import chalk from 'chalk';
import { initDb, pool } from './memory/db.js';
import { initRedis, getRedis } from './memory/redis.js';
import { initRouter } from './gateway/router.js';
import { startCLI } from './gateway/cli.js';
import { startTelegram } from './gateway/telegram.js';
import { startWeb } from './gateway/web.js';
import { startDiscord } from './gateway/discord.js';
import { startSlack } from './gateway/slack.js';
import { config } from './config/index.js';
import { isWhatsAppConfigured } from './gateway/whatsapp.js';
import { initSandbox } from './tools/sandbox.js';
import { startProcessCleanup, stopProcessCleanup } from './tools/process-registry.js';
import { initKillSwitchListener, reportHeartbeat } from './security/index.js';
import { TaskScheduler } from './agents/scheduled-tasks.js';
import { createProactiveCheckInTask } from './agents/check-in.js';
import { loadAndRegisterAllJobs, setJobDeliverCallback } from './agents/cron-scheduler.js';
import { deliverJobOutput } from './agents/cron-delivery.js';
import { initMemoryBackend } from './memory/backends/index.js';
import { startBaileysWhatsApp, isBaileysConfigured } from './gateway/baileys/whatsapp-baileys.js';
import { importInboundMedia, importWorkspaceFiles } from './sync/agent-sync.js';
import { startSkillCuratorSchedule } from './skills/curator-scheduler.js';
import { initSkills } from './skills/index.js';
import { applyActiveProfileFromDisk } from './profiles/manager.js';
import { channelRegistry } from './gateway/channels/channel-registry.js';
import { registerProcessCompletionHandler } from './tools/process-notifications.js';
import './tools/index.js';

registerProcessCompletionHandler(async (event) => {
  const adapter = channelRegistry.getByName(event.channel);
  if (adapter?.enabled) {
    await adapter.sendMessage(event.conversationId, event.message);
  }
});

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let cleanupKillSwitch: (() => void) | null = null;
let taskScheduler: TaskScheduler | null = null;

async function shutdown(signal: string): Promise<void> {
  console.log(chalk.gray(`\nReceived ${signal}, shutting down...`));
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  taskScheduler?.stop();
  cleanupKillSwitch?.();
  await pool.end().catch(() => undefined);
  const redis = getRedis();
  if (redis) redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function main(): Promise<void> {
  applyActiveProfileFromDisk();
  await initSandbox();
  startProcessCleanup();
  let memoryReady = false;

  try {
    await initDb();
    initMemoryBackend();
    memoryReady = true;
    const jobCount = await loadAndRegisterAllJobs();
    await initSkills();
    startSkillCuratorSchedule();
    if (process.env.CARINA_IMPORT_WORKSPACE === 'true') {
      const { imported } = await importWorkspaceFiles();
      if (imported.length > 0) {
        console.log(chalk.gray(`Workspace import: ${imported.join(', ')}`));
      }
    }
    if (process.env.CARINA_IMPORT_MEDIA === 'true') {
      const { imported, skipped } = await importInboundMedia();
      if (imported.length > 0 || skipped > 0) {
        console.log(chalk.gray(`Inbound media import: ${imported.length} new, ${skipped} skipped`));
      }
    }
    console.log(chalk.gray(`Memory store ready (${jobCount} scheduled jobs loaded)`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`Memory store unavailable: ${msg}`));
    console.warn(chalk.yellow('Continuing without persistent memory.'));
  }

  await initRedis();

  if (config.labyrinth.enabled) {
    cleanupKillSwitch = initKillSwitchListener();
    void reportHeartbeat();
    heartbeatInterval = setInterval(() => void reportHeartbeat(), 60_000);
  }

  initRouter(memoryReady);
  setJobDeliverCallback(async (job, output) => {
    const sent = await deliverJobOutput(job, output);
    if (sent.length > 0) {
      console.log(chalk.gray(`[cron] delivered to ${sent.join(', ')}`));
    }
  });

  if (process.env.CARINA_CHECK_IN_ENABLED === 'true') {
    taskScheduler = new TaskScheduler();
    taskScheduler.register(createProactiveCheckInTask('cli'));
    taskScheduler.start();
    console.log(chalk.gray('Proactive check-in cycle enabled'));
  }

  const gateways: Promise<void>[] = [];

  if (config.telegram.botToken) {
    gateways.push(startTelegram());
  } else {
    console.warn(chalk.yellow('Telegram gateway skipped: TELEGRAM_BOT_TOKEN not set'));
  }

  if (config.web.enabled) {
    gateways.push(startWeb());
  }

  gateways.push(startDiscord());
  gateways.push(startSlack());
  gateways.push(startBaileysWhatsApp());

  if (process.env.SKIP_CLI !== 'true') {
    gateways.push(startCLI({ memoryReady }));
  }

  if (!isBaileysConfigured() && !isWhatsAppConfigured()) {
    console.warn(
      chalk.yellow(
        'WhatsApp gateway skipped: set BAILEYS_WHATSAPP_ENABLED=true or Twilio credentials',
      ),
    );
  }

  await Promise.all(gateways);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
