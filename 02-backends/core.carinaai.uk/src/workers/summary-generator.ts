import { Cron } from 'croner';
import { pool } from '../memory/db.js';
import type { Worker } from '../types/index.js';
import { isAivaDailySummaryEnabled, isPropreneurBridgeEnabled } from './aiva-feature-flags.js';
import { listWorkersWithSummaryEnabled, resolvePropreneurBinding } from './worker-bridge-store.js';
import { getDeals, getEmailActivity, getPortfolio } from '../bridges/propreneur-bridge.js';
import { listRecentDigests } from '../ingestion/email/email-connection-store.js';
import { logActivity } from './worker-store.js';
import { listWorkerChannelDetails, readChannelCredentials } from '../channels/channel-store.js';
import { getAdapter } from '../channels/adapter-registry.js';
import { lookupWorker } from '../channels/worker-registry.js';
import { synthesizeSummaryAudio, sendTelegramAudioFile } from './summary-tts.js';

const workerCrons = new Map<string, Cron>();

function defaultSummaryCron(): string {
  return process.env.AIVA_DAILY_SUMMARY_CRON ?? '0 7 * * *';
}

function workerSummaryCron(worker: Worker): string {
  return worker.workerConfig?.summary?.summarySchedule?.trim() || defaultSummaryCron();
}

export { workerSummaryCron };

function formatDateHeader(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

export async function buildDailySummaryText(worker: Worker): Promise<string> {
  const sections: string[] = [`Daily briefing - ${formatDateHeader()}`, `Aiva: ${worker.name}`, ''];

  const binding = resolvePropreneurBinding(worker);
  let hasActivity = false;

  if (binding && isPropreneurBridgeEnabled()) {
    try {
      const [emailActivity, portfolio, deals] = await Promise.all([
        getEmailActivity(binding, 24),
        getPortfolio(binding),
        getDeals(binding, 'open'),
      ]);

      const emailTotal = Number((emailActivity as { total?: number }).total ?? 0);
      if (emailTotal > 0) {
        hasActivity = true;
        sections.push(`Emails (24h): ${emailTotal} processed via Propreneur`);
        const recent = (emailActivity as { recent?: Array<{ subject?: string; classification?: string }> }).recent ?? [];
        for (const row of recent.slice(0, 5)) {
          sections.push(`- ${row.subject ?? 'No subject'} (${row.classification ?? 'other'})`);
        }
        sections.push('');
      }

      const expiring = portfolio.properties.filter((p) => p.epc_expiry).slice(0, 5);
      if (expiring.length > 0) {
        hasActivity = true;
        sections.push('Portfolio snapshot:');
        for (const p of expiring) {
          sections.push(`- ${p.label}: EPC expires ${p.epc_expiry}`);
        }
        sections.push('');
      }

      const openDeals = deals.total;
      if (openDeals > 0) {
        hasActivity = true;
        sections.push(`Open pipeline deals: ${openDeals}`);
        sections.push('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[summary-generator] Propreneur data unavailable for ${worker.id}: ${message}`);
    }
  }

  const digests = await listRecentDigests(worker.id, 10);
  const recentDigests = digests.filter((d) => d.summary);
  if (recentDigests.length > 0) {
    hasActivity = true;
    sections.push('Carina email digests:');
    for (const digest of recentDigests.slice(0, 5)) {
      sections.push(`- ${digest.from}: ${digest.summary}`);
    }
    sections.push('');
  }

  if (!hasActivity) {
    return [
      `Quiet day - ${formatDateHeader()}`,
      `${worker.name}: no new emails or portfolio changes in the last 24 hours.`,
      'Reply anytime to ask about your portfolio.',
    ].join('\n');
  }

  sections.push('Reply to ask me anything about your portfolio.');
  return sections.join('\n');
}

async function listTelegramContacts(workerId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT contact_id FROM channel_threads
     WHERE worker_id = $1 AND channel = 'telegram'
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT 5`,
    [workerId],
  );
  return result.rows.map((row) => String(row.contact_id));
}

async function deliverSummaryToTelegram(worker: Worker, text: string): Promise<number> {
  const channels = await listWorkerChannelDetails(worker.id);
  const telegram = channels.find((c) => c.channel === 'telegram' && c.enabled);
  if (!telegram) return 0;

  const entry = lookupWorker('telegram', telegram.identifier);
  if (!entry) return 0;

  const adapter = getAdapter('telegram');
  if (!adapter) return 0;

  const credentials = readChannelCredentials(telegram);
  const contacts = await listTelegramContacts(worker.id);
  if (contacts.length === 0) return 0;

  let sent = 0;
  for (const contactId of contacts) {
    await adapter.send(
      { channel: 'telegram', contactId, content: text },
      credentials,
    );
    sent += 1;
  }
  return sent;
}

async function deliverSummaryAudioToTelegram(worker: Worker, text: string): Promise<number> {
  if (worker.workerConfig?.summary?.includeAudio !== true) {
    return 0;
  }

  const channels = await listWorkerChannelDetails(worker.id);
  const telegram = channels.find((c) => c.channel === 'telegram' && c.enabled);
  if (!telegram) return 0;

  const entry = lookupWorker('telegram', telegram.identifier);
  if (!entry) return 0;

  const credentials = readChannelCredentials(telegram);
  const botToken = credentials.bot_token ?? credentials.token;
  if (!botToken) return 0;

  const contacts = await listTelegramContacts(worker.id);
  if (contacts.length === 0) return 0;

  let audio: { filePath: string; cleanup: () => Promise<void> } | null = null;
  try {
    audio = await synthesizeSummaryAudio(text);
    let sent = 0;
    const caption = `Daily briefing audio - ${worker.name}`;
    for (const contactId of contacts) {
      await sendTelegramAudioFile(botToken, contactId, audio.filePath, caption);
      sent += 1;
    }
    return sent;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[summary-generator] TTS delivery skipped for ${worker.id}: ${message}`);
    return 0;
  } finally {
    if (audio) {
      await audio.cleanup().catch(() => {});
    }
  }
}

export async function runDailySummaryForWorker(worker: Worker): Promise<void> {
  const text = await buildDailySummaryText(worker);
  const sent = await deliverSummaryToTelegram(worker, text);
  const audioSent = await deliverSummaryAudioToTelegram(worker, text);
  await logActivity(worker.id, {
    actionType: 'summary_sent',
    summary: 'Daily portfolio summary',
    outputText: text,
    escalated: false,
    channel: 'telegram',
  });
  if (sent === 0 && audioSent === 0) {
    console.warn(`[summary-generator] No Telegram delivery for worker ${worker.id}`);
  }
}

async function scheduleWorkerSummary(worker: Worker): Promise<void> {
  const existing = workerCrons.get(worker.id);
  if (existing) {
    existing.stop();
    workerCrons.delete(worker.id);
  }

  const expression = workerSummaryCron(worker);
  const job = new Cron(expression, { timezone: 'Europe/London' }, () => {
    void runDailySummaryForWorker(worker).catch((err) => {
      console.error('[summary-generator] worker failed:', worker.id, err);
    });
  });
  workerCrons.set(worker.id, job);
  console.log(`[summary-generator] Scheduled ${worker.name} (${worker.id}) at ${expression}`);
}

export async function refreshWorkerSummarySchedule(workerId: string): Promise<void> {
  if (!isAivaDailySummaryEnabled()) return;
  const workers = await listWorkersWithSummaryEnabled();
  const worker = workers.find((w) => w.id === workerId);
  if (worker) {
    await scheduleWorkerSummary(worker);
    return;
  }
  const existing = workerCrons.get(workerId);
  if (existing) {
    existing.stop();
    workerCrons.delete(workerId);
  }
}

async function runAllDailySummaries(): Promise<void> {
  if (!isAivaDailySummaryEnabled()) return;
  const workers = await listWorkersWithSummaryEnabled();
  for (const worker of workers) {
    try {
      await runDailySummaryForWorker(worker);
    } catch (err) {
      console.error('[summary-generator] worker failed:', worker.id, err);
    }
  }
}

export async function startDailySummaryCron(): Promise<void> {
  if (!isAivaDailySummaryEnabled()) return;

  const workers = await listWorkersWithSummaryEnabled();
  if (workers.length > 0) {
    for (const worker of workers) {
      await scheduleWorkerSummary(worker);
    }
    return;
  }

  if (workerCrons.has('__fallback__')) return;
  const expression = defaultSummaryCron();
  const fallback = new Cron(expression, { timezone: 'Europe/London' }, () => {
    void runAllDailySummaries();
  });
  workerCrons.set('__fallback__', fallback);
  console.log(`[summary-generator] Fallback daily summary cron (${expression})`);
}

export function stopDailySummaryCron(): void {
  for (const cron of workerCrons.values()) {
    cron.stop();
  }
  workerCrons.clear();
}
