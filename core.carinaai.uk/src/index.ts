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
import { initKillSwitchListener, reportHeartbeat } from './security/index.js';
import './tools/index.js';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let cleanupKillSwitch: (() => void) | null = null;

async function shutdown(signal: string): Promise<void> {
  console.log(chalk.gray(`\nReceived ${signal}, shutting down...`));
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  cleanupKillSwitch?.();
  await pool.end().catch(() => undefined);
  const redis = getRedis();
  if (redis) redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function main(): Promise<void> {
  await initSandbox();
  let memoryReady = false;

  try {
    await initDb();
    memoryReady = true;
    console.log(chalk.gray('Memory store ready'));
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

  if (process.env.SKIP_CLI !== 'true') {
    gateways.push(startCLI({ memoryReady }));
  }

  if (!isWhatsAppConfigured()) {
    console.warn(
      chalk.yellow(
        'WhatsApp gateway skipped: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM',
      ),
    );
  }

  await Promise.all(gateways);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
