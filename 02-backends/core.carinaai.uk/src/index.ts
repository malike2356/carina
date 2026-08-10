import chalk from 'chalk';
import { initDb, pool } from './memory/db.js';
import { initRedis, getRedis } from './memory/redis.js';
import { initRouter } from './gateway/router.js';
import { startCLI } from './gateway/cli.js';
import { startTelegram } from './gateway/telegram.js';
import { startWebGateway } from './gateway/load-web-package.js';
import { startDiscord } from './gateway/discord.js';
import { startSlack, createSlackAmbientSchedulerTask } from './gateway/slack.js';
import { config } from './config/index.js';
import { isDatabaseConfigured } from './config/database-url.js';
import { isWhatsAppConfigured } from './gateway/whatsapp.js';
import { initSandbox } from './tools/sandbox.js';
import { startProcessCleanup, stopProcessCleanup } from './tools/process-registry.js';
import { initScoutListener, reportHeartbeat, isScoutControlPlaneActive } from './security/index.js';
import { startScoutSyncScheduler, stopScoutSyncScheduler } from './security/scout/scout-sync.js';
import { TaskScheduler } from './agents/scheduled-tasks.js';
import { createProactiveCheckInTask } from './agents/check-in.js';
import { createRemNightlyTask, remNightlyEnabled } from './memory/rem/rem-scheduler.js';
import { createProviderQuotaPollTask, providerQuotaPollingEnabled } from './brain/provider-quota-poller.js';
import { createCommitmentDeliveryTask } from './commitments/delivery.js';
import { commitmentsEnabled } from './commitments/inference.js';
import { createReminderDeliveryTask } from './agents/reminder-delivery.js';
import { createAmbientEvictionTask } from './agents/ambient/stale-eviction.js';
import { loadAndRegisterAllJobs, setJobDeliverCallback } from './agents/cron-scheduler.js';
import { loadAndRegisterAllWorkflows } from './agents/cron-workflow-scheduler.js';
import { deliverJobOutput } from './agents/cron-delivery.js';
import { initMemoryBackend } from './memory/backends/index.js';
import { startBaileysWhatsApp, isBaileysConfigured } from './gateway/baileys/whatsapp-baileys.js';
import { importInboundMedia, importWorkspaceFiles } from './sync/agent-sync.js';
import { startSkillCuratorSchedule } from './skills/curator-scheduler.js';
import { startHubSyncSchedule, stopHubSyncSchedule } from './skills/hub-sync-scheduler.js';
import { startGithubBridgeSchedule, stopGithubBridgeSchedule } from './sync/github-bridge/index.js';
import { startBillingReconciliationSchedule } from './billing/reconciliation-scheduler.js';
import { initSkills } from './skills/index.js';
import { applyActiveProfileFromDisk } from './profiles/manager.js';
import { channelRegistry } from './gateway/channels/channel-registry.js';
import { stopChannelListeners } from './gateway/channel-bootstrap.js';
import { registerProcessCompletionHandler } from './tools/process-notifications.js';
import { registerSubagentPushWakeHandler } from './agents/subagent-push-wake.js';
import { preloadPlatformKnowledge } from './platform/knowledge.js';
import { loadSettingsFromDb } from './config/settings-loader.js';
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
let cleanupScoutSync: (() => void) | null = null;
let taskScheduler: TaskScheduler | null = null;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(chalk.gray(`\nReceived ${signal}, shutting down...`));
  const forceTimer = setTimeout(() => {
    console.error('[shutdown] timed out after 25s, exiting');
    process.exit(1);
  }, 25_000);
  forceTimer.unref();
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  taskScheduler?.stop();
  cleanupKillSwitch?.();
  cleanupScoutSync?.();
  stopChannelListeners();
  stopProcessCleanup();
  const { stopWebhookRetrySweep } = await import('./webhooks/dispatcher.js');
  stopWebhookRetrySweep();
  stopHubSyncSchedule();
  stopGithubBridgeSchedule();
  const { stopAcpServer } = await import('./acp/acp-server.js');
  stopAcpServer();
  const { shutdownOtel } = await import('./telemetry/otel.js');
  await shutdownOtel().catch(() => undefined);
  const { persistRaspSignalsOnShutdown } = await import('./security/rasp/engine.js');
  await persistRaspSignalsOnShutdown().catch(() => undefined);
  if (isDatabaseConfigured()) {
    await pool.end().catch(() => undefined);
  }
  const redis = getRedis();
  if (redis) redis.disconnect();
  clearTimeout(forceTimer);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function main(): Promise<void> {
  try {
    const { installCarinaErrorHandling } = await import('./errors/runtime.js');
    installCarinaErrorHandling();
  } catch {
    // never block boot on error-handler install
  }
  const { initSentry } = await import('./observability/sentry.js');
  await initSentry();

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
      await loadSettingsFromDb();
      try {
        const { applyLlmRotationSettingsFromDb } = await import('./ops/llm-rotation-platform.js');
        const { llm } = await import('./brain/llm.js');
        const saved = await applyLlmRotationSettingsFromDb();
        const provider = (process.env.DEFAULT_PROVIDER || '').trim().toLowerCase();
        const model = (process.env.DEFAULT_MODEL || '').trim() || undefined;
        if (provider) {
          try {
            if (llm.isProviderConfigured(provider)) {
              llm.use(provider, model);
            }
          } catch {
            /* provider may lack keys at boot */
          }
        }
        if (Object.keys(saved).length > 0) {
          console.log(chalk.gray(`LLM platform settings loaded (${Object.keys(saved).length} keys)`));
        }
      } catch (err) {
        console.warn(
          chalk.yellow('LLM platform settings hydrate skipped:'),
          err instanceof Error ? err.message : String(err),
        );
      }
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
      const { loadAndRegisterAllAivaAutomations } = await import('./workers/aiva-automation-scheduler.js');
      const aivaAutomationCount = await loadAndRegisterAllAivaAutomations();
      const { registerWorkerPlaybookSchedulesOnStartup } = await import('./api/worker-playbook-api.js');
      const playbookScheduleCount = await registerWorkerPlaybookSchedulesOnStartup();
      const { recoverProcessesOnStartup } = await import('./tools/process-registry.js');
      const recoveredProcesses = await recoverProcessesOnStartup();
      const { rehydrateRuntimeTools } = await import('./tools/dynamic/rehydrate.js');
      const rehydratedCount = await rehydrateRuntimeTools();
      const { startWebhookRetrySweep } = await import('./webhooks/dispatcher.js');
      startWebhookRetrySweep();
      await initSkills();
      startSkillCuratorSchedule();
      startHubSyncSchedule();
      void startGithubBridgeSchedule();
      startBillingReconciliationSchedule();
      if (process.env.AI_WORKERS_ENABLED !== 'false') {
        const { startAivaTrialEmailCron, startAivaGraceSuspendCron } = await import('./email/trial-email-cron.js');
        startAivaTrialEmailCron();
        startAivaGraceSuspendCron();
        const { startGdprHardDeleteCron } = await import('./email/gdpr-cron.js');
        startGdprHardDeleteCron();
        const { startCronHeartbeatWriter } = await import('./health/cron-heartbeat.js');
        startCronHeartbeatWriter();
        const { startDailySummaryCron } = await import('./workers/summary-generator.js');
        await startDailySummaryCron();
        const { startEmailIngestionPoller } = await import('./ingestion/email/email-poller.js');
        startEmailIngestionPoller();
        const { startEmailApprovalTimeoutScheduler } = await import('./ingestion/email/approval-timeout-scheduler.js');
        startEmailApprovalTimeoutScheduler();
        const { startAivaScoutSchedulers } = await import('./billing/aiva-scout-schedulers.js');
        startAivaScoutSchedulers();
        const { startSocialTokenRefreshScheduler } = await import('./ingestion/social/token-refresh-scheduler.js');
        startSocialTokenRefreshScheduler();
        const { startContactsSyncScheduler } = await import('./contacts/contacts-sync-scheduler.js');
        startContactsSyncScheduler();
        const { startTikTokPoller } = await import('./ingestion/social/tiktok-poller.js');
        startTikTokPoller();
        const { startGoogleRecorderPoller } = await import('./ingestion/google-recorder/recorder-poller.js');
        startGoogleRecorderPoller();
        const { startSocialApprovalTimeoutScheduler } = await import('./ingestion/social/social-approval-timeout-scheduler.js');
        startSocialApprovalTimeoutScheduler();
        if (process.env.AIVA_WORKER_ISOLATION !== 'false') {
          const { getAivaWorkerPool } = await import('./agents/worker-pool.js');
          const { startAivaWorkerPoolHealthCheck } = await import('./agents/worker-pool-health.js');
          startAivaWorkerPoolHealthCheck(getAivaWorkerPool());
        }
      }
      const recoveryNote = recoveredProcesses > 0 ? `, ${recoveredProcesses} background processes recovered` : '';
      const runtimeNote = rehydratedCount > 0 ? `, ${rehydratedCount} runtime tools rehydrated` : '';
      console.log(chalk.gray(`Memory store ready (${jobCount} jobs, ${workflowCount} workflows, ${aivaAutomationCount} aiva automations${recoveryNote}${runtimeNote})`));

      // Scheduled Scout security checks for the self-modification pipeline
      if (process.env.SCOUT_SELF_MOD_AUTO_RESPONSE !== 'false') {
        const { runScheduledSecurityChecks, runDailyDeepAudit } = await import('./security/scheduled-checks.js');
        setInterval(() => { void runScheduledSecurityChecks(); }, 5 * 60 * 1000);
        const auditHour = parseInt((process.env.SCOUT_SELF_MOD_DAILY_AUDIT_TIME ?? '02:00').split(':')[0] ?? '2', 10);
        const now = new Date();
        const nextAudit = new Date(now);
        nextAudit.setUTCHours(auditHour, 0, 0, 0);
        if (nextAudit <= now) nextAudit.setUTCDate(nextAudit.getUTCDate() + 1);
        setTimeout(() => {
          void runDailyDeepAudit();
          setInterval(() => { void runDailyDeepAudit(); }, 24 * 60 * 60 * 1000);
        }, nextAudit.getTime() - now.getTime());
      }
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

  // Outreach PG cache must not depend on skill-pack boot succeeding above.
  try {
    const { ensureOutreachStoreReady } = await import('./outreach/store.js');
    await ensureOutreachStoreReady();
    const { startOutreachProcessDueScheduler } = await import('./outreach/process-due-scheduler.js');
    startOutreachProcessDueScheduler();
    console.log(chalk.gray('Outreach store ready'));
  } catch (err) {
    console.warn(
      chalk.yellow('Outreach store init failed:'),
      err instanceof Error ? err.message : String(err),
    );
  }

  await initRedis();

  if (isScoutControlPlaneActive()) {
    cleanupKillSwitch = initScoutListener();
    cleanupScoutSync = startScoutSyncScheduler();
    void reportHeartbeat();
    heartbeatInterval = setInterval(() => void reportHeartbeat(), 60_000);
    const { startScoutAgenticSchedulers } = await import('./security/scout/scout-agentic-scheduler.js');
    startScoutAgenticSchedulers();
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
    || process.env.CARINA_REMINDER_DELIVERY !== 'false'
    || process.env.CARINA_AMBIENT_MODE_ENABLED === 'true'
    || process.env.CARINA_MUTATION_QUALITY !== 'false') {
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
    if (process.env.CARINA_AMBIENT_MODE_ENABLED === 'true') {
      taskScheduler.register(createAmbientEvictionTask());
      const ambientTask = createSlackAmbientSchedulerTask();
      if (ambientTask) {
        taskScheduler.register(ambientTask);
      }
      console.log(chalk.gray('Ambient channel agent enabled'));
    }
    if (process.env.CARINA_MUTATION_QUALITY !== 'false') {
      taskScheduler.register({
        name: 'mutation-engine-daily-prune',
        hour: 3,
        minute: 0,
        timezone: process.env.TZ ?? 'UTC',
        run: async () => {
          const { runFullPrune } = await import('./mutation/pruner.js');
          await runFullPrune(false);
        },
      });
      console.log(chalk.gray('Mutation engine daily prune enabled (03:00)'));
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
