import { createAutomation, listAutomations } from '../../workers/worker-store.js';
import { registerAutomationJob } from '../../workers/workspace-automation-scheduler.js';
import { getBinding, listMappings } from './store.js';
import { getKnowledgeEntry } from '../../workers/knowledge-base.js';

export const OPS_REMINDER_TEMPLATES = [
  {
    key: 'day-before-meeting',
    name: 'Ops: day before next meeting',
    cronExpression: '0 9 * * *',
    scheduleLabel: 'Daily 09:00',
    prompt: `Read the synced "NEXT meeting" document in knowledge.
If a meeting is tomorrow (or the soonest upcoming date is tomorrow), draft a short reminder with when, invitees, and agenda from that document only.
Do not invent people or agenda items. If missing, say what to add in Aiva documents or Drive.
Prefer WhatsApp/email send only when the channel is connected; otherwise leave a draft for approval.`,
  },
  {
    key: 'day-after-meeting',
    name: 'Ops: day after meeting minutes',
    cronExpression: '0 10 * * *',
    scheduleLabel: 'Daily 10:00',
    prompt: `If yesterday's meeting likely happened (from NEXT meeting or recent minutes), remind the operator to add minutes and attendance in Aiva documents (Workspace Ops).
Do not invent attendees. Link them to the Knowledge / Drive documents tab.`,
  },
  {
    key: 'monthly-funder-pack',
    name: 'Ops: monthly activity report',
    cronExpression: '0 9 1 * *',
    scheduleLabel: '1st of month 09:00',
    prompt: `Remind the operator to fill this month's Monthly report document with verified counts and activity notes only.
Optionally draft an update into a Doc using synced facts. Require human approval before any external send.`,
  },
  {
    key: 'sync-health',
    name: 'Ops: sync health check',
    cronExpression: '0 */6 * * *',
    scheduleLabel: 'Every 6 hours',
    prompt: `Check Workspace Ops sync status for this worker. If last_error is set and older than 6 hours, notify the workspace admin with the plain-English error. Do not invent sync failures.`,
  },
] as const;

export type OpsReminderKey = (typeof OPS_REMINDER_TEMPLATES)[number]['key'];

export async function installOpsReminderAutomations(opts: {
  workspaceId: string;
  workerId: string;
  keys?: OpsReminderKey[];
}): Promise<{ installed: string[]; skipped: string[] }> {
  const want = new Set(opts.keys ?? OPS_REMINDER_TEMPLATES.map((t) => t.key));
  const existing = await listAutomations(opts.workerId);
  const installed: string[] = [];
  const skipped: string[] = [];

  for (const template of OPS_REMINDER_TEMPLATES) {
    if (!want.has(template.key)) continue;
    if (existing.some((a) => a.name === template.name)) {
      skipped.push(template.key);
      continue;
    }
    const automation = await createAutomation(opts.workerId, opts.workspaceId, {
      name: template.name,
      description: template.prompt,
      cronExpression: template.cronExpression,
      scheduleLabel: template.scheduleLabel,
      triggerType: 'cron',
      actionType: 'aiva_prompt',
      actionJson: { type: 'aiva_prompt', prompt: template.prompt },
      approvalMode: template.key === 'monthly-funder-pack' ? 'require_write' : 'require_write',
    });
    await registerAutomationJob(automation.id, template.cronExpression);
    installed.push(template.key);
  }

  return { installed, skipped };
}

/** Ground a reminder prompt in the next-meeting document when present. */
export async function buildGroundedMeetingContext(
  workspaceId: string,
  workerId: string,
): Promise<string> {
  const binding = await getBinding(workspaceId, workerId);
  if (!binding) return '';
  const mappings = await listMappings(binding.id);
  const next = mappings.find((m) => m.category === 'next-meeting' && m.aivaDocumentId);
  if (!next?.aivaDocumentId) return '';
  const entry = await getKnowledgeEntry(workerId, next.aivaDocumentId);
  if (!entry) return '';
  return `\n\nSynced NEXT meeting document:\n${entry.content}`;
}

export async function enqueueOpsReminderHook(opts: {
  workspaceId: string;
  workerId: string;
  reminderKey?: OpsReminderKey;
  note?: string;
}): Promise<{ ok: true; prompt: string }> {
  const key = opts.reminderKey ?? 'day-before-meeting';
  const template = OPS_REMINDER_TEMPLATES.find((t) => t.key === key);
  if (!template) throw new Error(`Unknown reminder key: ${key}`);
  const grounded = await buildGroundedMeetingContext(opts.workspaceId, opts.workerId);
  const prompt = [
    template.prompt,
    grounded,
    opts.note ? `\nOperator note: ${opts.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { ok: true, prompt };
}
