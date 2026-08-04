import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { registerSessionTool } from './session-tool-store.js';
import {
  createAutomation,
  deleteAutomation,
  getAutomation,
  listAutomations,
  listAutomationsForWorkspace,
  toggleAutomation,
} from '../workers/worker-store.js';
import { parseScheduleText } from '../workers/schedule-parser.js';
import {
  computeNextRun,
  normalizeSchedule,
  type AutomationSchedule,
} from '../workers/automation-trigger-schema.js';
import { registerAutomationJob, unregisterAutomationJob } from '../workers/workspace-automation-scheduler.js';
import { resolveWorkspacePlanTier } from '../billing/aiva-plan-gates.js';
import { hasPlanTier } from '../billing/plan-tier.js';

function buildMorningDigestPrompt(input: {
  city: string;
  country: string;
  emailLimit: number;
}): string {
  const city = input.city.trim() || 'Portsmouth';
  const country = input.country.trim() || 'GB';
  const limit = Math.min(10, Math.max(1, input.emailLimit));
  return [
    'Build today\'s morning digest. Reply with the full briefing only (no tool chatter or preamble).',
    'IMPORTANT: Do this yourself in this turn. Do NOT delegate to a subagent or communication agent.',
    '',
    `1. Weather for ${city}, ${country}: call weather-forecast with city="${city}" and country="${country}".`,
    '   Summarise today: conditions, high/low C, rain chance, wind if notable.',
    `2. Emails: call gmail-list with limit=${limit} and q="newer_than:1d".`,
    '   For each message, call gmail-get and include subject, from, and a short body summary (2-3 sentences).',
    '   If none, say the inbox had no new mail in the last day.',
    '3. Format for Telegram: short sections, plain text, under 3500 characters.',
  ].join('\n');
}

/** Parse common English daily times without an LLM round-trip. */
export function parseSimpleDailySchedule(text: string): {
  hour: number;
  minute: number;
} | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;

  const ampm = raw.match(
    /(?:every\s+day|daily|each\s+morning)?\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/,
  );
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? 0);
    const meridiem = ampm[3];
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  const twentyFour = raw.match(
    /(?:every\s+day|daily)?\s*(?:at\s+)?(\d{1,2}):(\d{2})\b/,
  );
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  const bareHour = raw.match(
    /(?:every\s+day|daily|each\s+morning)\s*(?:at\s+)?(\d{1,2})\b/,
  );
  if (bareHour) {
    const hour = Number(bareHour[1]);
    if (hour >= 0 && hour <= 23) return { hour, minute: 0 };
  }

  return null;
}

async function resolveSchedule(params: Record<string, unknown>): Promise<{
  cronExpression: string;
  scheduleLabel: string;
  schedule: AutomationSchedule;
  timezone: string;
  nextRunAt: Date | null;
}> {
  const timezone = String(params.timezone ?? 'Europe/London').trim() || 'Europe/London';
  const scheduleText = String(params.schedule_text ?? params.scheduleText ?? '').trim();

  let hour: number | null = params.hour != null ? Number(params.hour) : null;
  let minute: number | null = params.minute != null ? Number(params.minute) : null;

  if ((hour == null || Number.isNaN(hour)) && scheduleText) {
    const simple = parseSimpleDailySchedule(scheduleText);
    if (simple) {
      hour = simple.hour;
      minute = simple.minute;
    }
  }

  if (hour != null && !Number.isNaN(hour)) {
    const atHour = Math.max(0, Math.min(23, Math.floor(hour)));
    const atMinute = Math.max(0, Math.min(59, Math.floor(minute ?? 0)));
    const schedule = normalizeSchedule({ type: 'daily', atHour, atMinute });
    return {
      cronExpression: `${atMinute} ${atHour} * * *`,
      scheduleLabel: `Daily at ${String(atHour).padStart(2, '0')}:${String(atMinute).padStart(2, '0')} (${timezone})`,
      schedule,
      timezone,
      nextRunAt: computeNextRun(schedule, timezone, new Date()),
    };
  }

  if (scheduleText) {
    const parsed = await parseScheduleText(scheduleText);
    const schedule = normalizeSchedule({ type: 'cron', cron: parsed.cronExpression });
    return {
      cronExpression: parsed.cronExpression,
      scheduleLabel: `${parsed.scheduleLabel} (${timezone})`,
      schedule,
      timezone,
      nextRunAt: computeNextRun(schedule, timezone, new Date()),
    };
  }

  const schedule = normalizeSchedule({ type: 'daily', atHour: 8, atMinute: 0 });
  return {
    cronExpression: '0 8 * * *',
    scheduleLabel: `Daily at 08:00 (${timezone})`,
    schedule,
    timezone,
    nextRunAt: computeNextRun(schedule, timezone, new Date()),
  };
}

export function createWorkerAutomationTools(sessionId: string): Tool[] {
  return [
    {
      name: 'worker-automation',
      dangerous: true,
      requiresConfirmation: false,
      description:
        'Create and manage this Aiva worker\'s scheduled automations (morning digests, recurring briefings). '
        + 'PRIMARY tool for Aiva cron/schedule/digest questions. Do NOT use host cronjob for Aiva workers. '
        + 'Actions: create, list, pause, resume, remove, test. '
        + 'list: this worker by default; pass scope="workspace" to include all workers in the workspace. '
        + 'test: pass automation_id, or omit it / use "all" to test every enabled job on this worker. '
        + 'For morning weather + email digests: set city, schedule_text or hour/minute, timezone (default Europe/London). '
        + 'Delivery defaults to the current chat channel (e.g. Telegram).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'pause', 'resume', 'remove', 'test'],
          },
          automation_id: {
            type: 'string',
            description: 'Automation id. For test, omit or use "all" to run every enabled job on this worker.',
          },
          scope: {
            type: 'string',
            enum: ['worker', 'workspace'],
            description: 'For list: worker (default) or workspace (all Aivas in this workspace).',
          },
          name: { type: 'string', description: 'Short job name' },
          description: { type: 'string', description: 'What the job does' },
          prompt: {
            type: 'string',
            description: 'Self-contained prompt the agent runs on each fire. Optional if city is set (morning digest template).',
          },
          schedule_text: {
            type: 'string',
            description: 'Plain English schedule, e.g. "every day at 8am"',
          },
          hour: { type: 'number', description: 'Daily hour 0-23 (preferred with timezone)' },
          minute: { type: 'number', description: 'Daily minute 0-59' },
          timezone: {
            type: 'string',
            description: 'IANA timezone. Default Europe/London.',
          },
          city: {
            type: 'string',
            description: 'For morning digests: weather city (e.g. Portsmouth)',
          },
          country: {
            type: 'string',
            description: 'ISO country code for weather (default GB)',
          },
          email_limit: {
            type: 'number',
            description: 'Max recent emails to summarise (default 5)',
          },
          deliver_channel: {
            type: 'string',
            description: 'Where to send the result: telegram, web, etc. Defaults to current chat.',
          },
          deliver_contact_id: {
            type: 'string',
            description: 'Contact/chat id for delivery. Defaults to current chat.',
          },
        },
        required: ['action'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) {
          return { ok: false, error: 'No worker session context; worker-automation is only available in Aiva chat.' };
        }

        const planTier = await resolveWorkspacePlanTier(ctx.worker.workspaceId);
        if (!hasPlanTier(planTier, 'team')) {
          return {
            ok: false,
            error: 'Scheduled automations require a Team plan (or active trial).',
            code: 'PLAN_UPGRADE_REQUIRED',
            planTier,
          };
        }

        const action = String(params.action ?? '').trim();
        const workerId = ctx.worker.id;
        const workspaceId = ctx.worker.workspaceId;

        if (action === 'list') {
          const scope = String(params.scope ?? 'worker').trim().toLowerCase() === 'workspace'
            ? 'workspace'
            : 'worker';
          const automations = scope === 'workspace'
            ? await listAutomationsForWorkspace(workspaceId)
            : await listAutomations(workerId);
          return {
            ok: true,
            scope,
            count: automations.length,
            note: automations.length === 0
              ? 'No scheduled automations yet. Create a morning digest with action=create and city=...'
              : undefined,
            automations: automations.map((a) => ({
              id: a.id,
              workerId: a.workerId,
              name: a.name,
              description: a.description,
              scheduleLabel: a.scheduleLabel,
              cronExpression: a.cronExpression,
              timezone: a.timezone,
              enabled: a.enabled,
              nextRunAt: a.nextRunAt?.toISOString() ?? null,
              lastRunAt: a.lastRunAt?.toISOString() ?? null,
              lastRunStatus: a.lastRunStatus ?? null,
              lastRunError: a.lastRunError ?? null,
              consecutiveFailures: a.consecutiveFailures ?? 0,
              deliver: (a.action && typeof a.action === 'object')
                ? (a.action as { deliver?: unknown }).deliver ?? null
                : null,
            })),
          };
        }

        if (action === 'pause' || action === 'resume' || action === 'remove' || action === 'test') {
          const automationIdRaw = String(params.automation_id ?? '').trim();
          const testAll = action === 'test'
            && (!automationIdRaw || /^(all|\*|every)$/i.test(automationIdRaw));

          if (testAll) {
            const automations = (await listAutomations(workerId)).filter((a) => a.enabled);
            if (automations.length === 0) {
              return { ok: false, error: 'No enabled automations on this worker to test.' };
            }
            const { enqueueAutomationRun } = await import('../workers/automation-run-queue.js');
            const { tickAutomationWorkers } = await import('../workers/automation-trigger-engine.js');
            const { listAutomationRuns } = await import('../workers/automation-run-queue.js');
            const results: Array<Record<string, unknown>> = [];
            for (const existing of automations) {
              const run = await enqueueAutomationRun({
                automationId: existing.id,
                workerId,
                workspaceId,
                triggerKind: existing.triggerType === 'event' ? 'event' : 'schedule',
                payload: { test: true },
                actor: 'chat-test-all',
              });
              if (!run) {
                results.push({
                  automation_id: existing.id,
                  name: existing.name,
                  ok: false,
                  error: 'A run is already queued for this automation',
                });
                continue;
              }
              await tickAutomationWorkers(1);
              const runs = await listAutomationRuns(existing.id, 1);
              results.push({
                automation_id: existing.id,
                name: existing.name,
                ok: true,
                run: runs[0] ?? run,
              });
            }
            return { ok: true, tested: results.length, results };
          }

          const automationId = automationIdRaw;
          if (!automationId) return { ok: false, error: 'automation_id required' };
          const existing = await getAutomation(automationId);
          if (!existing || existing.workerId !== workerId) {
            return { ok: false, error: 'Automation not found for this worker' };
          }

          if (action === 'remove') {
            unregisterAutomationJob(automationId);
            await deleteAutomation(automationId);
            return { ok: true, removed: automationId };
          }

          if (action === 'pause' || action === 'resume') {
            const enabled = action === 'resume';
            await toggleAutomation(automationId, enabled);
            if (enabled && existing.cronExpression) {
              registerAutomationJob(automationId, existing.cronExpression, existing.timezone);
            } else {
              unregisterAutomationJob(automationId);
            }
            return { ok: true, automation_id: automationId, enabled };
          }

          const { enqueueAutomationRun } = await import('../workers/automation-run-queue.js');
          const { tickAutomationWorkers } = await import('../workers/automation-trigger-engine.js');
          const run = await enqueueAutomationRun({
            automationId,
            workerId,
            workspaceId,
            triggerKind: existing.triggerType === 'event' ? 'event' : 'schedule',
            payload: { test: true },
            actor: 'chat-test',
          });
          if (!run) {
            return { ok: false, error: 'A run is already queued for this automation' };
          }
          await tickAutomationWorkers(1);
          const { listAutomationRuns } = await import('../workers/automation-run-queue.js');
          const runs = await listAutomationRuns(automationId, 1);
          return { ok: true, run: runs[0] ?? run };
        }

        if (action !== 'create') {
          return { ok: false, error: `Unknown action: ${action}` };
        }

        const city = String(params.city ?? '').trim();
        const country = String(params.country ?? 'GB').trim() || 'GB';
        const emailLimit = Number(params.email_limit ?? 5);
        const customPrompt = String(params.prompt ?? '').trim();
        const prompt = customPrompt
          || (city
            ? buildMorningDigestPrompt({ city, country, emailLimit })
            : '');
        if (!prompt) {
          return {
            ok: false,
            error: 'prompt or city is required for create (city builds a morning weather + email digest).',
          };
        }

        const name = String(params.name ?? '').trim()
          || (city ? `Morning digest (${city})` : 'Scheduled briefing');
        const description = String(params.description ?? '').trim()
          || (city
            ? `Daily morning weather for ${city} plus recent email summaries`
            : prompt.slice(0, 200));

        const schedule = await resolveSchedule(params);
        let deliverChannel = String(
          params.deliver_channel ?? ctx.channel ?? 'web',
        ).trim() || 'web';
        let deliverContactId = String(
          params.deliver_contact_id ?? ctx.contactId ?? '',
        ).trim();
        // Prefer a real messaging peer when creating from web (or with a synthetic auto-* contact).
        if (
          !params.deliver_channel
          && (!deliverContactId || deliverChannel === 'web' || deliverContactId.startsWith('auto-'))
        ) {
          try {
            const { pool } = await import('../memory/db.js');
            const preferred = await pool.query<{ channel: string; channel_contact_id: string }>(
              `SELECT channel, channel_contact_id
                 FROM aiva_contact_identities
                WHERE workspace_id = $1
                  AND worker_id = $2
                  AND channel = ANY($3::text[])
                  AND channel_contact_id IS NOT NULL
                  AND channel_contact_id <> ''
                  AND channel_contact_id NOT LIKE 'auto-%'
                  AND channel_contact_id NOT IN ('1', 'app', 'realtime-owner', 'owner')
                ORDER BY last_seen_at DESC NULLS LAST
                LIMIT 1`,
              [workspaceId, workerId, ['telegram', 'whatsapp', 'sms']],
            );
            let row = preferred.rows[0];
            if (!row) {
              const fromActivity = await pool.query<{ channel: string; contact_id: string }>(
                `SELECT channel, contact_id
                   FROM ai_worker_activity
                  WHERE worker_id = $1
                    AND channel = ANY($2::text[])
                    AND contact_id IS NOT NULL
                    AND contact_id <> ''
                    AND contact_id NOT LIKE 'auto-%'
                  ORDER BY created_at DESC
                  LIMIT 1`,
                [workerId, ['telegram', 'whatsapp', 'sms']],
              );
              if (fromActivity.rows[0]?.contact_id) {
                row = {
                  channel: fromActivity.rows[0].channel,
                  channel_contact_id: fromActivity.rows[0].contact_id,
                };
              }
            }
            if (row) {
              deliverChannel = row.channel;
              deliverContactId = row.channel_contact_id;
            }
          } catch {
            /* keep web defaults */
          }
        }

        const actionJson: Record<string, unknown> = {
          type: 'aiva_prompt',
          prompt,
        };
        if (deliverContactId) {
          actionJson.deliver = {
            channel: deliverChannel,
            contactId: deliverContactId,
          };
        }

        const automation = await createAutomation(workerId, workspaceId, {
          name,
          description,
          cronExpression: schedule.cronExpression,
          scheduleLabel: schedule.scheduleLabel,
          triggerType: 'schedule',
          timezone: schedule.timezone,
          scheduleJson: schedule.schedule as unknown as Record<string, unknown>,
          actionType: 'aiva_prompt',
          actionJson,
          conditionsJson: [],
          approvalMode: 'auto',
          nextRunAt: schedule.nextRunAt,
        });

        if (automation.cronExpression) {
          registerAutomationJob(automation.id, automation.cronExpression, automation.timezone);
        }

        return {
          ok: true,
          automation: {
            id: automation.id,
            name: automation.name,
            scheduleLabel: automation.scheduleLabel,
            cronExpression: automation.cronExpression,
            timezone: automation.timezone,
            nextRunAt: automation.nextRunAt?.toISOString() ?? null,
            deliver: actionJson.deliver ?? null,
          },
          tip: 'Say "test my morning digest" or call worker-automation action=test with automation_id to run once now.',
        };
      },
    },
  ];
}

export function registerWorkerAutomationSessionTools(sessionId: string): void {
  for (const tool of createWorkerAutomationTools(sessionId)) {
    registerSessionTool(sessionId, tool);
  }
}
