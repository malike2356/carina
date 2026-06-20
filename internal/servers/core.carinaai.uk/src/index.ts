import chalk from 'chalk';
import { initDb, pool } from './memory/db.js';
import { initRedis, getRedis } from './memory/redis.js';
import { initRouter } from './gateway/router.js';
import { startCLI } from './gateway/cli.js';
import { startTelegram } from './gateway/telegram.js';
import { startWebGateway } from './gateway/load-web-package.js';
import { startDiscord } from './gateway/discord.js';
import { startSlack } from './gateway/slack.js';
import { config } from './config/index.js';
import { isWhatsAppConfigured } from './gateway/whatsapp.js';
import { initSandbox } from './tools/sandbox.js';
import { startProcessCleanup, stopProcessCleanup } from './tools/process-registry.js';
import { initKillSwitchListener, reportHeartbeat } from './security/index.js';
import { TaskScheduler } from './agents/scheduled-tasks.js';
import { createProactiveCheckInTask } from './agents/check-in.js';
import { createRemNightlyTask, remNightlyEnabled } from './memory/rem/rem-scheduler.js';
import { createProviderQuotaPollTask, providerQuotaPollingEnabled } from './brain/provider-quota-poller.js';
import { createCommitmentDeliveryTask } from './commitments/delivery.js';
import { commitmentsEnabled } from './commitments/inference.js';
import { createReminderDeliveryTask } from './agents/reminder-delivery.js';
import { loadAndRegisterAllJobs, setJobDeliverCallback } from './agents/cron-scheduler.js';
import { loadAndRegisterAllWorkflows } from './agents/cron-workflow-scheduler.js';
import { deliverJobOutput } from './agents/cron-delivery.js';
import { initMemoryBackend } from './memory/backends/index.js';
import { startBaileysWhatsApp, isBaileysConfigured } from './gateway/baileys/whatsapp-baileys.js';
import { importInboundMedia, importWorkspaceFiles } from './sync/agent-sync.js';
import { startSkillCuratorSchedule } from './skills/curator-scheduler.js';
import { startHubSyncSchedule, stopHubSyncSchedule } from './skills/hub-sync-scheduler.js';
import { startBillingReconciliationSchedule } from './billing/reconciliation-scheduler.js';
import { initSkills } from './skills/index.js';
import { applyActiveProfileFromDisk } from './profiles/manager.js';
import { channelRegistry } from './gateway/channels/channel-registry.js';
import { stopChannelListeners } from './gateway/channel-bootstrap.js';
import { registerProcessCompletionHandler } from './tools/process-notifications.js';
import { registerSubagentPushWakeHandler } from './agents/subagent-push-wake.js';
import { preloadPlatformKnowledge } from './platform/knowledge.js';
import './tools/index.js';

registerProcessCompletionHandler(async (event) => {
  const adapter = channelRegistry.getByName(event.channel);
  if (adapter?.enabled) {
    await adapter.sendMessage(event.conversationId, event.message);
  }
});

registerSubagentPushWakeHandler();

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let cleanupKillSwitch: (() => void) | null = null;
let taskScheduler: TaskScheduler | null = null;

async function shutdown(signal: string): Promise<void> {
  console.log(chalk.gray(`\nReceived ${signal}, shutting down...`));
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  taskScheduler?.stop();
  cleanupKillSwitch?.();
  stopChannelListeners();
  stopProcessCleanup();
  const { stopWebhookRetrySweep } = await import('./webhooks/dispatcher.js');
  stopWebhookRetrySweep();
  stopHubSyncSchedule();
  const { stopAcpServer } = await import('./acp/acp-server.js');
  stopAcpServer();
  const { shutdownOtel } = await import('./telemetry/otel.js');
  await shutdownOtel().catch(() => undefined);
  await pool.end().catch(() => undefined);
  const redis = getRedis();
  if (redis) redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function main(): Promise<void> {
  applyActiveProfileFromDisk();

  const { otelEnabled, initOtel, getOtelStatus } = await import('./telemetry/otel.js');
  if (otelEnabled()) {
    const ok = await initOtel();
    if (ok) {
      const otel = getOtelStatus();
      console.log(chalk.gray(`OpenTelemetry export enabled (${otel.exporter ?? 'otlp'}, ${otel.serviceName})`));
    }
  }

  await preloadPlatformKnowledge();
  await initSandbox();
  startProcessCleanup();
  let memoryReady = false;

  const localOnly = process.env.CARINA_SKIP_POSTGRES === 'true'
    || (process.env.CARINA_LOCAL_MODE === 'true'
      && ['sqlite', 'builtin'].includes((process.env.CARINA_MEMORY_BACKEND ?? 'builtin').toLowerCase()));

  try {
    if (localOnly) {
      initMemoryBackend();
      memoryReady = true;
      const { initOperatorPackStore } = await import('./skills/operator-pack-store.js');
      await initOperatorPackStore({ fileOnly: true });
      await initSkills();
      console.log(chalk.gray('Local mode: SQLite memory (Postgres skipped)'));
    } else {
      await initDb();
      if (config.hosted.enabled) {
        const { initHostedDb, maybeBootstrapHostedAccount } = await import('./api/hosted-auth.js');
        await initHostedDb();
        await maybeBootstrapHostedAccount();
        console.log(chalk.gray('Hosted SaaS schema ready'));
      }
      const { initOperatorPackStore } = await import('./skills/operator-pack-store.js');
      await initOperatorPackStore();
      initMemoryBackend();
      memoryReady = true;
      const jobCount = await loadAndRegisterAllJobs();
      const workflowCount = await loadAndRegisterAllWorkflows();
      const { recoverProcessesOnStartup } = await import('./tools/process-registry.js');
      const recoveredProcesses = await recoverProcessesOnStartup();
      const { startWebhookRetrySweep } = await import('./webhooks/dispatcher.js');
      startWebhookRetrySweep();
      await initSkills();
      startSkillCuratorSchedule();
      startHubSyncSchedule();
      startBillingReconciliationSchedule();
      const recoveryNote = recoveredProcesses > 0 ? `, ${recoveredProcesses} background processes recovered` : '';
      console.log(chalk.gray(`Memory store ready (${jobCount} jobs, ${workflowCount} workflows${recoveryNote})`));
    }
    if (process.env.CARINA_IMPORT_WORKSPACE === 'true') {
      const { imported, updated } = await importWorkspaceFiles();
      if (imported.length > 0) {
        console.log(chalk.gray(`Workspace import: ${imported.join(', ')}`));
      }
      if (updated.length > 0) {
        console.log(chalk.gray(`Workspace updated: ${updated.join(', ')}`));
      }
    }

    const { startWorkspaceWatcher } = await import('./memory/workspace-watcher.js');
    startWorkspaceWatcher();
    if (process.env.CARINA_IMPORT_MEDIA === 'true') {
      const { imported, skipped } = await importInboundMedia();
      if (imported.length > 0 || skipped > 0) {
        console.log(chalk.gray(`Inbound media import: ${imported.length} new, ${skipped} skipped`));
      }
    }
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

  const { startAcpServer } = await import('./acp/acp-server.js');
  startAcpServer();

  setJobDeliverCallback(async (job, output) => {
    const sent = await deliverJobOutput(job, output);
    if (sent.length > 0) {
      console.log(chalk.gray(`[cron] delivered to ${sent.join(', ')}`));
    }
  });

  if (process.env.CARINA_CHECK_IN_ENABLED === 'true' || commitmentsEnabled()
    || process.env.CARINA_REMINDER_DELIVERY !== 'false') {
    taskScheduler = new TaskScheduler(60_000);
    if (process.env.CARINA_CHECK_IN_ENABLED === 'true') {
      taskScheduler.register(createProactiveCheckInTask('cli', { memoryReady }));
      console.log(chalk.gray('Proactive check-in cycle enabled'));
    }
    if (remNightlyEnabled()) {
      taskScheduler.register(createRemNightlyTask());
      console.log(chalk.gray('REM nightly memory dreaming enabled'));
    }
    if (providerQuotaPollingEnabled()) {
      taskScheduler.register(createProviderQuotaPollTask());
      console.log(chalk.gray('Provider quota polling enabled'));
    }
    if (commitmentsEnabled()) {
      taskScheduler.register(createCommitmentDeliveryTask());
      console.log(chalk.gray('Inferred commitment delivery enabled'));
    }
    if (process.env.CARINA_REMINDER_DELIVERY !== 'false') {
      taskScheduler.register(createReminderDeliveryTask());
      console.log(chalk.gray('Notes reminder delivery enabled'));
    }
    taskScheduler.start();
  }

  if (process.env.CARINA_TASKFLOWS_ENABLED !== 'false') {
    const { startTaskFlowWorkerLoop } = await import('./ops/taskflows/worker.js');
    startTaskFlowWorkerLoop();
    console.log(chalk.gray('TaskFlow worker enabled (set CARINA_TASKFLOWS_ENABLED=false to disable)'));
  }

  const gateways: Promise<void>[] = [];

  if (config.telegram.botToken) {
    gateways.push(startTelegram());
  } else {
    console.warn(chalk.yellow('Telegram gateway skipped: TELEGRAM_BOT_TOKEN not set'));
  }

  if (config.web.enabled) {
    gateways.push(startWebGateway().then(() => undefined));
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
