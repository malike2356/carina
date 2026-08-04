/**
 * Aiva automation trigger schema: schedule/event triggers, actions, conditions.
 * Reimplements MyApi-style trigger behavior without copying AGPL code.
 */

export type AutomationTriggerKind = 'schedule' | 'event';

export type AutomationSchedule =
  | { type: 'interval'; everyMinutes: number }
  | { type: 'daily'; atHour: number; atMinute: number }
  | { type: 'weekly'; weekday: number; atHour: number; atMinute: number }
  | { type: 'monthly'; day: number; atHour: number; atMinute: number }
  | { type: 'cron'; cron: string }
  | { type: 'once'; at: string };

export type AutomationEventTrigger = {
  source: 'email_received' | 'webhook' | 'message_received' | 'connector';
  eventType?: string;
  connector?: string;
};

export type AutomationActionType =
  | 'aiva_prompt'
  | 'connector_action'
  | 'playbook'
  | 'webhook_call';

export type AutomationApprovalMode = 'auto' | 'require_write' | 'always';

export type AutomationAction =
  | { type: 'aiva_prompt'; prompt: string }
  | { type: 'connector_action'; connector: string; method: string; params?: Record<string, unknown> }
  | { type: 'playbook'; playbookId?: string }
  | { type: 'webhook_call'; url: string; method?: 'POST' | 'PUT'; body?: Record<string, unknown> };

export type AutomationCondition = {
  field: string;
  op: 'eq' | 'contains' | 'exists';
  value?: string;
};

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'done'
  | 'failed'
  | 'skipped';

export function scheduleLabelFrom(schedule: AutomationSchedule): string {
  switch (schedule.type) {
    case 'interval':
      return `Every ${schedule.everyMinutes} minute${schedule.everyMinutes === 1 ? '' : 's'}`;
    case 'daily':
      return `Daily at ${pad(schedule.atHour)}:${pad(schedule.atMinute)}`;
    case 'weekly': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[schedule.weekday] ?? 'Weekly'} at ${pad(schedule.atHour)}:${pad(schedule.atMinute)}`;
    }
    case 'monthly':
      return `Monthly on day ${schedule.day} at ${pad(schedule.atHour)}:${pad(schedule.atMinute)}`;
    case 'cron':
      return `Cron ${schedule.cron}`;
    case 'once':
      return `Once at ${schedule.at}`;
    default:
      return 'Custom schedule';
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseScheduleInput(input: {
  schedule?: AutomationSchedule;
  scheduleText?: string;
  cronExpression?: string;
}): { schedule: AutomationSchedule; label: string; cronExpression: string } {
  if (input.schedule) {
    const schedule = normalizeSchedule(input.schedule);
    return {
      schedule,
      label: scheduleLabelFrom(schedule),
      cronExpression: cronFromSchedule(schedule),
    };
  }
  if (input.cronExpression?.trim()) {
    const schedule: AutomationSchedule = { type: 'cron', cron: input.cronExpression.trim() };
    return { schedule, label: scheduleLabelFrom(schedule), cronExpression: schedule.cron };
  }
  throw new Error('schedule or cronExpression is required for schedule triggers');
}

export function normalizeSchedule(raw: AutomationSchedule): AutomationSchedule {
  switch (raw.type) {
    case 'interval': {
      const everyMinutes = Math.max(1, Math.min(24 * 60, Number(raw.everyMinutes) || 30));
      return { type: 'interval', everyMinutes };
    }
    case 'daily':
      return {
        type: 'daily',
        atHour: clampHour(raw.atHour),
        atMinute: clampMinute(raw.atMinute),
      };
    case 'weekly':
      return {
        type: 'weekly',
        weekday: Math.max(0, Math.min(6, Number(raw.weekday) || 1)),
        atHour: clampHour(raw.atHour),
        atMinute: clampMinute(raw.atMinute),
      };
    case 'monthly':
      return {
        type: 'monthly',
        day: Math.max(1, Math.min(28, Number(raw.day) || 1)),
        atHour: clampHour(raw.atHour),
        atMinute: clampMinute(raw.atMinute),
      };
    case 'cron': {
      const cron = String(raw.cron || '').trim();
      if (!cron) throw new Error('cron expression required');
      return { type: 'cron', cron };
    }
    case 'once': {
      const at = String(raw.at || '').trim();
      if (!at || Number.isNaN(Date.parse(at))) throw new Error('once.at must be an ISO datetime');
      return { type: 'once', at };
    }
    default:
      throw new Error('Unsupported schedule type');
  }
}

function clampHour(v: unknown): number {
  return Math.max(0, Math.min(23, Number(v) || 0));
}

function clampMinute(v: unknown): number {
  return Math.max(0, Math.min(59, Number(v) || 0));
}

/** Best-effort cron for legacy Croner registration. */
export function cronFromSchedule(schedule: AutomationSchedule): string {
  switch (schedule.type) {
    case 'interval': {
      const m = schedule.everyMinutes;
      if (m < 60 && 60 % m === 0) return `*/${m} * * * *`;
      if (m % 60 === 0) return `0 */${m / 60} * * *`;
      return `*/${Math.min(m, 59)} * * * *`;
    }
    case 'daily':
      return `${schedule.atMinute} ${schedule.atHour} * * *`;
    case 'weekly':
      return `${schedule.atMinute} ${schedule.atHour} * * ${schedule.weekday}`;
    case 'monthly':
      return `${schedule.atMinute} ${schedule.atHour} ${schedule.day} * *`;
    case 'cron':
      return schedule.cron;
    case 'once':
      return '0 0 1 1 *';
    default:
      return '0 * * * *';
  }
}

/**
 * Compute next run after `from` in the given IANA timezone (falls back to UTC).
 */
export function computeNextRun(
  schedule: AutomationSchedule,
  timezone = 'UTC',
  from: Date = new Date(),
): Date | null {
  if (schedule.type === 'once') {
    const at = new Date(schedule.at);
    return at.getTime() > from.getTime() ? at : null;
  }
  if (schedule.type === 'interval') {
    return new Date(from.getTime() + schedule.everyMinutes * 60_000);
  }
  if (schedule.type === 'cron') {
    return nextFromSimpleCron(schedule.cron, from, timezone);
  }

  // daily / weekly / monthly: walk forward day by day in local wall clock
  for (let i = 0; i < 400; i += 1) {
    const candidate = new Date(from.getTime() + i * 86_400_000);
    const parts = zonedParts(candidate, timezone);
    if (schedule.type === 'daily') {
      const hit = atLocalTime(parts, schedule.atHour, schedule.atMinute, timezone);
      if (hit && hit.getTime() > from.getTime()) return hit;
    }
    if (schedule.type === 'weekly' && parts.weekday === schedule.weekday) {
      const hit = atLocalTime(parts, schedule.atHour, schedule.atMinute, timezone);
      if (hit && hit.getTime() > from.getTime()) return hit;
    }
    if (schedule.type === 'monthly' && parts.day === schedule.day) {
      const hit = atLocalTime(parts, schedule.atHour, schedule.atMinute, timezone);
      if (hit && hit.getTime() > from.getTime()) return hit;
    }
  }
  return null;
}

function zonedParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    const bag: Record<string, string> = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== 'literal') bag[part.type] = part.value;
    }
    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return {
      year: Number(bag.year),
      month: Number(bag.month),
      day: Number(bag.day),
      hour: Number(bag.hour),
      minute: Number(bag.minute),
      weekday: weekdayMap[bag.weekday ?? ''] ?? date.getUTCDay(),
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      weekday: date.getUTCDay(),
    };
  }
}

function atLocalTime(
  parts: { year: number; month: number; day: number },
  hour: number,
  minute: number,
  timeZone: string,
): Date | null {
  // Approximate: build an ISO-like UTC guess then adjust (good enough for automation ticks).
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0));
  const observed = zonedParts(guess, timeZone);
  const deltaMin =
    (hour - observed.hour) * 60 + (minute - observed.minute);
  return new Date(guess.getTime() + deltaMin * 60_000);
}

/** Minimal 5-field cron next-fire helper (minute hour dom month dow). */
function nextFromSimpleCron(cron: string, from: Date, timeZone = 'UTC'): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;
  for (let i = 1; i <= 60 * 24 * 400; i += 1) {
    const candidate = new Date(from.getTime() + i * 60_000);
    const zoned = zonedParts(candidate, timeZone);
    if (!matchCronField(minExpr, zoned.minute)) continue;
    if (!matchCronField(hourExpr, zoned.hour)) continue;
    if (!matchCronField(domExpr, zoned.day)) continue;
    if (!matchCronField(monthExpr, zoned.month)) continue;
    if (!matchCronField(dowExpr, zoned.weekday)) continue;
    return atLocalTime(
      { year: zoned.year, month: zoned.month, day: zoned.day },
      zoned.hour,
      zoned.minute,
      timeZone,
    );
  }
  return null;
}

function matchCronField(expr: string, value: number): boolean {
  if (expr === '*') return true;
  if (expr.startsWith('*/')) {
    const step = Number(expr.slice(2));
    return step > 0 && value % step === 0;
  }
  if (expr.includes(',')) {
    return expr.split(',').some((p) => Number(p) === value);
  }
  return Number(expr) === value;
}

export function conditionsPass(
  conditions: AutomationCondition[] | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => {
    const raw = payload[c.field];
    if (c.op === 'exists') return raw !== undefined && raw !== null && raw !== '';
    const text = raw == null ? '' : String(raw);
    if (c.op === 'eq') return text === String(c.value ?? '');
    if (c.op === 'contains') return text.toLowerCase().includes(String(c.value ?? '').toLowerCase());
    return false;
  });
}

export function actionNeedsApproval(
  actionType: AutomationActionType,
  approvalMode: AutomationApprovalMode,
): boolean {
  if (approvalMode === 'always') return true;
  if (approvalMode === 'auto') return false;
  return actionType === 'connector_action' || actionType === 'webhook_call';
}

export function parseAction(raw: unknown, fallbackPrompt: string): AutomationAction {
  if (!raw || typeof raw !== 'object') {
    return { type: 'aiva_prompt', prompt: fallbackPrompt };
  }
  const obj = raw as Record<string, unknown>;
  const type = String(obj.type ?? 'aiva_prompt') as AutomationActionType;
  if (type === 'connector_action') {
    return {
      type: 'connector_action',
      connector: String(obj.connector ?? ''),
      method: String(obj.method ?? ''),
      params: (obj.params && typeof obj.params === 'object')
        ? obj.params as Record<string, unknown>
        : undefined,
    };
  }
  if (type === 'playbook') {
    return { type: 'playbook', playbookId: obj.playbookId ? String(obj.playbookId) : undefined };
  }
  if (type === 'webhook_call') {
    return {
      type: 'webhook_call',
      url: String(obj.url ?? ''),
      method: obj.method === 'PUT' ? 'PUT' : 'POST',
      body: (obj.body && typeof obj.body === 'object')
        ? obj.body as Record<string, unknown>
        : undefined,
    };
  }
  return {
    type: 'aiva_prompt',
    prompt: String(obj.prompt ?? fallbackPrompt),
  };
}
