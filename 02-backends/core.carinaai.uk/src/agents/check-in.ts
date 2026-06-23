import { pool } from '../memory/db.js';
import type { CarinaMessage } from '../types/index.js';
import { checkRecentInboundEmails, type CheckResult } from './checks/email-check.js';
import { checkProjectStatus } from './checks/project-status-check.js';
import { checkWeather } from './checks/weather-check.js';
import { checkIncidentResearch } from './checks/incident-research-check.js';
import { loadHeartbeatState, saveHeartbeatState } from './heartbeat-state.js';
import { loadWorkspaceFile } from '../workspace/context-files.js';
import { getDefaultAgentDefinition } from '../workspaces/agent-registry.js';
import { resolveAgentWorkspace } from '../workspaces/paths.js';

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
  heartbeatGuidance?: string;
}

const CHECK_ROTATION = ['email', 'weather', 'project-status', 'incident-research'] as const;
const CHECK_IN_SESSION = '__proactive_check_in__';
const memoryState = new Map<string, CheckInState>();

export type CheckInDeliverFn = (message: string, source: CarinaMessage['source']) => Promise<boolean>;

export interface CheckInInboxMessage {
  message: string;
  deliveredAt: string;
  source: CarinaMessage['source'];
}

const webInbox: CheckInInboxMessage[] = [];
let deliverFn: CheckInDeliverFn | null = null;

export function setCheckInDeliverFn(fn: CheckInDeliverFn): void {
  deliverFn = fn;
}

export function getCheckInWebInbox(): CheckInInboxMessage[] {
  return [...webInbox];
}

export function clearCheckInWebInbox(): void {
  webInbox.length = 0;
}

export function parseCheckInResponse(text: string): { deliver: boolean; message: string } {
  const trimmed = text.trim();
  if (!trimmed || trimmed === 'NO_CHECK_IN_NEEDED') {
    return { deliver: false, message: trimmed };
  }
  return { deliver: true, message: trimmed };
}

export function shouldStayQuiet(context: QuietContext): boolean {
  const urgent = context.urgentSignals.some((signal) => signal.urgent);
  if (!urgent && isWithinQuietHours(context.now, context.quietHours)) return true;
  if (context.lastCheckAt && context.now.getTime() - context.lastCheckAt.getTime() < 30 * 60_000) return true;
  if (!urgent && context.lastContactedAt && context.now.getTime() - context.lastContactedAt.getTime() < 8 * 60 * 60_000) {
    return true;
  }
  return false;
}

export async function loadHeartbeatGuidance(workspaceDir?: string): Promise<string> {
  const home = workspaceDir ?? resolveAgentWorkspace(getDefaultAgentDefinition());
  return (await loadWorkspaceFile(home, 'HEARTBEAT.md')) ?? '';
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
    } else if (check === 'incident-research') {
      results.push(await checkIncidentResearch());
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

  const heartbeatBlock = options.heartbeatGuidance?.trim()
    ? `\n\nHEARTBEAT.md guidance:\n${options.heartbeatGuidance.trim()}`
    : '';

  const prompt = `Proactive check-in cycle.

Review the check results below. Decide whether anything is genuinely worth surfacing to the user.
If nothing is worth mentioning, respond exactly: NO_CHECK_IN_NEEDED
If something is worth mentioning, send one short, useful message grounded only in these results.

Calendar and social-media checks are intentionally unavailable: no integration or credentials exist yet.
${heartbeatBlock}

${summaries || 'No configured checks produced anything to review.'}`;

  return { prompt, results, nextState };
}

async function defaultDeliver(message: string, source: CarinaMessage['source']): Promise<boolean> {
  if (source === 'cli') {
    console.log(`[check-in] ${message}`);
    return true;
  }
  webInbox.push({ message, deliveredAt: new Date().toISOString(), source });
  return true;
}

async function runCheckInAgent(
  prompt: string,
  source: CarinaMessage['source'],
  memoryReady: boolean,
): Promise<string> {
  const { CarinaOrchestrator } = await import('./orchestrator.js');
  const { buildAgentRuntimeContext } = await import('../workspaces/agent-context.js');
  const { getDefaultAgentDefinition: getDefaultAgent } = await import('../workspaces/agent-registry.js');

  const runtime = await buildAgentRuntimeContext(getDefaultAgent(), { mode: 'full' });
  const agent = new CarinaOrchestrator(CHECK_IN_SESSION, memoryReady, async () => true, {
    platform: source,
  });
  agent.setSystemPromptSuffix(runtime.workspaceContext);

  const chunks: string[] = [];
  for await (const event of agent.turn(prompt)) {
    if (event.type === 'text') chunks.push(event.content);
  }
  return chunks.join('').trim();
}

export async function runProactiveCheckInCycle(options: {
  source?: CarinaMessage['source'];
  memoryReady?: boolean;
  projectPath?: string;
} = {}): Promise<{ delivered: boolean; message?: string; quiet: boolean }> {
  const source = options.source ?? 'cli';
  const state = await loadCheckInState(source);
  const heartbeatGuidance = await loadHeartbeatGuidance();
  const { prompt, results, nextState } = await buildCheckInPrompt({
    state,
    source,
    projectPath: options.projectPath ?? process.env.CARINA_PROJECT_PATH,
    heartbeatGuidance,
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

  const heartbeatState = await loadHeartbeatState();
  heartbeatState.lastChecks = {
    ...heartbeatState.lastChecks,
    ...nextState.lastChecks,
  };
  heartbeatState.updatedAt = new Date().toISOString();
  await saveHeartbeatState(heartbeatState);

  if (quiet) {
    await recordCheckInState(nextState);
    return { delivered: false, quiet: true };
  }

  const rawResponse = await runCheckInAgent(prompt, source, options.memoryReady ?? false);
  const parsed = parseCheckInResponse(rawResponse);
  if (!parsed.deliver) {
    await recordCheckInState(nextState);
    return { delivered: false, quiet: false };
  }

  const deliver = deliverFn ?? defaultDeliver;
  await deliver(parsed.message, source);
  await recordCheckInState({
    ...nextState,
    lastContactedAt: new Date().toISOString(),
  });
  return { delivered: true, message: parsed.message, quiet: false };
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

export function createProactiveCheckInTask(
  source: CarinaMessage['source'] = 'cli',
  options: { memoryReady?: boolean } = {},
): {
  name: string;
  intervalMinutes: number;
  run: () => Promise<void>;
} {
  return {
    name: 'proactive-check-in',
    intervalMinutes: Number(process.env.CARINA_CHECK_IN_INTERVAL_MINUTES ?? '30'),
    run: async () => {
      await runProactiveCheckInCycle({
        source,
        memoryReady: options.memoryReady ?? false,
        projectPath: process.env.CARINA_PROJECT_PATH,
      });
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

/** Tests only */
export function _resetCheckInMemoryStateForTests(): void {
  memoryState.clear();
  webInbox.length = 0;
  deliverFn = null;
}
