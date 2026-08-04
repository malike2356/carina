/**
 * Automation trigger engine: schedule tick, run worker, event ingress.
 */

import {
  claimAutomationRun,
  completeAutomationRun,
  enqueueAutomationRun,
  ensureAutomationTriggerSchema,
  readTriggerFields,
} from './automation-run-queue.js';
import { dispatchAutomationAction } from './automation-action-dispatcher.js';
import {
  computeNextRun,
  conditionsPass,
  cronFromSchedule,
  parseAction,
  type AutomationSchedule,
  type AutomationTriggerKind,
} from './automation-trigger-schema.js';
import {
  getAutomation,
  getWorkerById,
  incrementAutomationFailure,
  listEnabledAutomations,
  resetAutomationFailureCounter,
  updateAutomationRunTimes,
} from './worker-store.js';
import { isAiWorkersEnabled } from './workspace-message-handler.js';
import { resolveWorkspacePlanTier } from '../billing/aiva-plan-gates.js';
import { hasPlanTier } from '../billing/plan-tier.js';
import { pool } from '../memory/db.js';

const ENGINE_ID = `aiva-engine-${process.pid}`;
let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let workerTimer: ReturnType<typeof setInterval> | null = null;

export async function enqueueDueAutomation(automationId: string, actor = 'scheduler'): Promise<boolean> {
  const automation = await getAutomation(automationId);
  if (!automation || !automation.enabled) return false;
  const worker = await getWorkerById(automation.workerId);
  if (!worker || worker.status !== 'active') return false;
  const planTier = await resolveWorkspacePlanTier(worker.workspaceId);
  if (!hasPlanTier(planTier, 'team')) return false;

  const run = await enqueueAutomationRun({
    automationId: automation.id,
    workerId: automation.workerId,
    workspaceId: automation.workspaceId,
    triggerKind: (automation.triggerType === 'event' ? 'event' : 'schedule') as AutomationTriggerKind,
    actor,
  });
  return Boolean(run);
}

export async function tickDueSchedules(): Promise<number> {
  if (!isAiWorkersEnabled()) return 0;
  await ensureAutomationTriggerSchema();
  const due = await pool.query(
    `SELECT * FROM ai_worker_automations
     WHERE enabled = TRUE
       AND (trigger_type = 'cron' OR trigger_type = 'schedule' OR trigger_type IS NULL)
       AND next_run_at IS NOT NULL
       AND next_run_at <= NOW()
     ORDER BY next_run_at ASC
     LIMIT 50`,
  );
  let queued = 0;
  for (const row of due.rows) {
    const id = String(row.id);
    const fields = readTriggerFields(row as Record<string, unknown>, String(row.description ?? ''));
    const schedule = fields.schedule
      ?? (row.cron_expression
        ? { type: 'cron', cron: String(row.cron_expression) } as AutomationSchedule
        : null);
    if (!schedule) continue;

    const enqueued = await enqueueDueAutomation(id, 'schedule-tick');
    if (enqueued) queued += 1;

    const next = computeNextRun(schedule, fields.timezone ?? 'UTC', new Date());
    await pool.query(
      `UPDATE ai_worker_automations SET next_run_at = $2 WHERE id = $1`,
      [id, next?.toISOString() ?? null],
    );
    if (schedule.type === 'once') {
      await pool.query(`UPDATE ai_worker_automations SET enabled = FALSE WHERE id = $1`, [id]);
    }
  }
  return queued;
}

export async function tickAutomationWorkers(maxClaims = 5): Promise<number> {
  if (!isAiWorkersEnabled()) return 0;
  await ensureAutomationTriggerSchema();
  let processed = 0;
  for (let i = 0; i < maxClaims; i += 1) {
    const run = await claimAutomationRun(ENGINE_ID);
    if (!run) break;
    processed += 1;
    const started = Date.now();
    try {
      const automation = await getAutomation(run.automationId);
      if (!automation) {
        await completeAutomationRun({
          runId: run.id,
          status: 'failed',
          error: 'Automation missing',
          durationMs: Date.now() - started,
        });
        continue;
      }
      const row = await pool.query(`SELECT * FROM ai_worker_automations WHERE id = $1`, [automation.id]);
      const fields = readTriggerFields(
        (row.rows[0] ?? {}) as Record<string, unknown>,
        automation.description,
      );
      if (!conditionsPass(fields.conditions, run.payload)) {
        await completeAutomationRun({
          runId: run.id,
          status: 'skipped',
          result: { reason: 'conditions_not_met' },
          durationMs: Date.now() - started,
        });
        continue;
      }

      const alreadyApproved = run.approvalStatus === 'approved';
      const result = await dispatchAutomationAction({
        workerId: run.workerId,
        workspaceId: run.workspaceId,
        automationId: automation.id,
        automationName: automation.name,
        automationDescription: automation.description,
        actionType: fields.actionType,
        action: fields.action,
        approvalMode: fields.approvalMode,
        payload: run.payload,
        alreadyApproved,
      });

      if (result.awaitingApproval) {
        await completeAutomationRun({
          runId: run.id,
          status: 'awaiting_approval',
          result: result.diagnostics,
          approvalStatus: 'pending',
          durationMs: Date.now() - started,
        });
        continue;
      }

      if (!result.ok) {
        await completeAutomationRun({
          runId: run.id,
          status: 'failed',
          error: result.error ?? 'Action failed',
          result: result.diagnostics,
          durationMs: Date.now() - started,
        });
        await incrementAutomationFailure(automation.id, result.error ?? 'Action failed');
        continue;
      }

      await completeAutomationRun({
        runId: run.id,
        status: 'done',
        result: { output: result.output, ...(result.diagnostics ?? {}) },
        usage: result.usage,
        durationMs: Date.now() - started,
      });
      await updateAutomationRunTimes(automation.id);
      await resetAutomationFailureCounter(automation.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await completeAutomationRun({
        runId: run.id,
        status: 'failed',
        error: message,
        durationMs: Date.now() - started,
        result: { diagnostics: true },
      }).catch(() => {});
      await incrementAutomationFailure(run.automationId, message).catch(() => {});
    }
  }
  return processed;
}

export async function enqueueEventAutomations(input: {
  workerId: string;
  eventSource: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  await ensureAutomationTriggerSchema();
  const result = await pool.query(
    `SELECT * FROM ai_worker_automations
     WHERE worker_id = $1 AND enabled = TRUE AND trigger_type = 'event'`,
    [input.workerId],
  );
  let count = 0;
  for (const row of result.rows) {
    const fields = readTriggerFields(row as Record<string, unknown>, String(row.description ?? ''));
    const source = fields.event?.source ?? String(row.trigger_event ?? '');
    if (source && source !== input.eventSource) continue;
    if (!conditionsPass(fields.conditions, input.payload)) continue;
    const run = await enqueueAutomationRun({
      automationId: String(row.id),
      workerId: String(row.worker_id),
      workspaceId: String(row.workspace_id),
      triggerKind: 'event',
      payload: input.payload,
      actor: `event:${input.eventSource}`,
    });
    if (run) count += 1;
  }
  return count;
}

export async function seedNextRunTimes(): Promise<number> {
  await ensureAutomationTriggerSchema();
  const automations = await listEnabledAutomations();
  let seeded = 0;
  for (const automation of automations) {
    if (automation.triggerType === 'event') continue;
    const row = await pool.query(`SELECT * FROM ai_worker_automations WHERE id = $1`, [automation.id]);
    const raw = row.rows[0] as Record<string, unknown> | undefined;
    if (!raw) continue;
    if (raw.next_run_at) continue;
    const fields = readTriggerFields(raw, automation.description);
    const schedule = fields.schedule
      ?? (automation.cronExpression
        ? { type: 'cron' as const, cron: automation.cronExpression }
        : null);
    if (!schedule) continue;
    const next = computeNextRun(schedule, fields.timezone ?? 'UTC', new Date());
    await pool.query(`UPDATE ai_worker_automations SET next_run_at = $2, schedule_json = COALESCE(schedule_json, $3::jsonb) WHERE id = $1`, [
      automation.id,
      next?.toISOString() ?? null,
      JSON.stringify(schedule),
    ]);
    seeded += 1;
  }
  return seeded;
}

export function startAutomationTriggerEngine(): void {
  if (scheduleTimer || workerTimer) return;
  void seedNextRunTimes().catch((err) => {
    console.warn('[aiva-automation-engine] seed failed:', err);
  });
  scheduleTimer = setInterval(() => {
    void tickDueSchedules().catch((err) => {
      console.warn('[aiva-automation-engine] schedule tick failed:', err);
    });
  }, 60_000);
  workerTimer = setInterval(() => {
    void tickAutomationWorkers().catch((err) => {
      console.warn('[aiva-automation-engine] worker tick failed:', err);
    });
  }, 10_000);
  if (typeof scheduleTimer.unref === 'function') scheduleTimer.unref();
  if (typeof workerTimer.unref === 'function') workerTimer.unref();
}

export function stopAutomationTriggerEngine(): void {
  if (scheduleTimer) clearInterval(scheduleTimer);
  if (workerTimer) clearInterval(workerTimer);
  scheduleTimer = null;
  workerTimer = null;
}

export function scheduleCronExpressionFor(schedule: AutomationSchedule): string {
  return cronFromSchedule(schedule);
}

export { parseAction };
