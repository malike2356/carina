import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { registerSessionTool } from './session-tool-store.js';
import {
  createAutomation,
  deleteAutomation,
  getAutomation,
  listAutomations,
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
        + 'Use this instead of host cronjob for Telegram/Aiva users. '
        + 'Actions: create, list, pause, resume, remove, test. '
        + 'For morning weather + email digests: set city, schedule_text or hour/minute, timezone (default Europe/London). '
        + 'Delivery defaults to the current chat channel (e.g. Telegram).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'pause', 'resume', 'remove', 'test'],
          },
          automation_id: { type: 'string' },
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
          const automations = await listAutomations(workerId);
          return {
            ok: true,
            count: automations.length,
            automations: automations.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              scheduleLabel: a.scheduleLabel,
              cronExpression: a.cronExpression,
              timezone: a.timezone,
              enabled: a.enabled,
              nextRunAt: a.nextRunAt?.toISOString() ?? null,
              lastRunAt: a.lastRunAt?.toISOString() ?? null,
              deliver: (a.action && typeof a.action === 'object')
                ? (a.action as { deliver?: unknown }).deliver ?? null
                : null,
            })),
          };
        }

        if (action === 'pause' || action === 'resume' || action === 'remove' || action === 'test') {
          const automationId = String(params.automation_id ?? '').trim();
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
        const deliverChannel = String(
          params.deliver_channel ?? ctx.channel ?? 'web',
        ).trim() || 'web';
        const deliverContactId = String(
          params.deliver_contact_id ?? ctx.contactId ?? '',
        ).trim();

        const actionJson: Record<string, unknown> = {
          type: 'aiva_prompt',
          prompt,
        };
        if (deliverContactId && deliverChannel !== 'web') {
          actionJson.deliver = {
            channel: deliverChannel,
            contactId: deliverContactId,
          };
        } else if (deliverContactId) {
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
