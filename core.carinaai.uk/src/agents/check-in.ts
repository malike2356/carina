import { pool } from '../memory/db.js';
import type { CarinaMessage } from '../types/index.js';
import { checkRecentInboundEmails, type CheckResult } from './checks/email-check.js';
import { checkProjectStatus } from './checks/project-status-check.js';
import { checkWeather } from './checks/weather-check.js';

export interface QuietHours {
  startHour: number;
  endHour: number;
  timezone?: string;
}

export interface CheckInState {
  key: string;
  lastChecks: Record<string, string>;
  lastCheckAt?: string;
  lastContactedAt?: string;
  rotationPosition: number;
}

export interface QuietContext {
  now: Date;
  lastContactedAt?: Date;
  lastCheckAt?: Date;
  quietHours: QuietHours;
  urgentSignals: CheckResult[];
}

export interface BuildCheckInOptions {
  state: CheckInState;
  source: CarinaMessage['source'];
  projectPath?: string;
}

const CHECK_ROTATION = ['email', 'weather', 'project-status'] as const;
const memoryState = new Map<string, CheckInState>();

export function shouldStayQuiet(context: QuietContext): boolean {
  const urgent = context.urgentSignals.some((signal) => signal.urgent);
  if (!urgent && isWithinQuietHours(context.now, context.quietHours)) return true;
  if (context.lastCheckAt && context.now.getTime() - context.lastCheckAt.getTime() < 30 * 60_000) return true;
  if (!urgent && context.lastContactedAt && context.now.getTime() - context.lastContactedAt.getTime() < 8 * 60 * 60_000) {
    return true;
  }
  return false;
}

export async function buildCheckInPrompt(options: BuildCheckInOptions): Promise<{
  prompt: string;
  results: CheckResult[];
  nextState: CheckInState;
}> {
  const selected = selectChecks(options.state.rotationPosition, options.source);
  const results: CheckResult[] = [];

  for (const check of selected) {
    if (check === 'email') {
      results.push(await checkRecentInboundEmails(parseDate(options.state.lastChecks.email)));
    } else if (check === 'weather') {
      results.push(await checkWeather());
    } else if (check === 'project-status') {
      results.push(await checkProjectStatus({ source: options.source, projectPath: options.projectPath }));
    }
  }

  const now = new Date();
  const nextState: CheckInState = {
    ...options.state,
    lastCheckAt: now.toISOString(),
    rotationPosition: (options.state.rotationPosition + selected.length) % CHECK_ROTATION.length,
    lastChecks: {
      ...options.state.lastChecks,
      ...Object.fromEntries(selected.map((name) => [name, now.toISOString()])),
    },
  };

  const summaries = results
    .filter((result) => result.summary)
    .map((result) => `## ${result.name}\n${result.summary}`)
    .join('\n\n');

  const prompt = `Proactive check-in cycle.

Review the check results below. Decide whether anything is genuinely worth surfacing to the user.
If nothing is worth mentioning, respond exactly: NO_CHECK_IN_NEEDED
If something is worth mentioning, send one short, useful message grounded only in these results.

Calendar and social-media checks are intentionally unavailable: no integration or credentials exist yet.

${summaries || 'No configured checks produced anything to review.'}`;

  return { prompt, results, nextState };
}

export async function loadCheckInState(key = 'default'): Promise<CheckInState> {
  try {
    const result = await pool.query<{
      state_key: string;
      last_checks: Record<string, string>;
      last_check_at: Date | null;
      last_contacted_at: Date | null;
      rotation_position: number;
    }>(
      `SELECT state_key, last_checks, last_check_at, last_contacted_at, rotation_position
       FROM check_in_state
       WHERE state_key = $1`,
      [key],
    );
    const row = result.rows[0];
    if (row) {
      return {
        key: row.state_key,
        lastChecks: row.last_checks ?? {},
        lastCheckAt: row.last_check_at?.toISOString(),
        lastContactedAt: row.last_contacted_at?.toISOString(),
        rotationPosition: row.rotation_position,
      };
    }
  } catch {
    const cached = memoryState.get(key);
    if (cached) return cached;
  }

  return { key, lastChecks: {}, rotationPosition: 0 };
}

export async function recordCheckInState(state: CheckInState): Promise<void> {
  memoryState.set(state.key, state);
  try {
    await pool.query(
      `INSERT INTO check_in_state (state_key, last_checks, last_check_at, last_contacted_at, rotation_position)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (state_key) DO UPDATE SET
         last_checks = EXCLUDED.last_checks,
         last_check_at = EXCLUDED.last_check_at,
         last_contacted_at = EXCLUDED.last_contacted_at,
         rotation_position = EXCLUDED.rotation_position,
         updated_at = NOW()`,
      [
        state.key,
        state.lastChecks,
        state.lastCheckAt ?? null,
        state.lastContactedAt ?? null,
        state.rotationPosition,
      ],
    );
  } catch {
    // In-memory fallback keeps self-hosted CLI usable without Postgres.
  }
}

export function createProactiveCheckInTask(source: CarinaMessage['source'] = 'cli'): {
  name: string;
  intervalMinutes: number;
  run: () => Promise<void>;
} {
  return {
    name: 'proactive-check-in',
    intervalMinutes: Number(process.env.CARINA_CHECK_IN_INTERVAL_MINUTES ?? '30'),
    run: async () => {
      const state = await loadCheckInState(source);
      const { results, nextState } = await buildCheckInPrompt({
        state,
        source,
        projectPath: process.env.CARINA_PROJECT_PATH,
      });
      const quiet = shouldStayQuiet({
        now: new Date(),
        lastCheckAt: parseDate(state.lastCheckAt),
        lastContactedAt: parseDate(state.lastContactedAt),
        quietHours: {
          startHour: Number(process.env.CARINA_QUIET_START_HOUR ?? '23'),
          endHour: Number(process.env.CARINA_QUIET_END_HOUR ?? '8'),
          timezone: process.env.TZ,
        },
        urgentSignals: results,
      });
      await recordCheckInState(quiet ? nextState : { ...nextState, lastContactedAt: new Date().toISOString() });
    },
  };
}

function selectChecks(position: number, source: CarinaMessage['source']): Array<typeof CHECK_ROTATION[number]> {
  const available = source === 'cli'
    ? [...CHECK_ROTATION]
    : CHECK_ROTATION.filter((name) => name !== 'project-status');
  return [available[position % available.length]].filter(Boolean);
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isWithinQuietHours(now: Date, quietHours: QuietHours): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: quietHours.timezone,
    hour: '2-digit',
    hour12: false,
  }).format(now));
  if (quietHours.startHour < quietHours.endHour) {
    return hour >= quietHours.startHour && hour < quietHours.endHour;
  }
  return hour >= quietHours.startHour || hour < quietHours.endHour;
}
