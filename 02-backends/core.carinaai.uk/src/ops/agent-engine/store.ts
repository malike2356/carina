/** Durable OPS agent-engine state (C05). */

import fs from 'node:fs';
import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';
import type {
  AgentEngineAuditEntry,
  AgentEngineConfig,
  AgentEngineLogEntry,
  AgentEngineName,
  AgentEngineState,
} from './types.js';

const STATE_FILE = () => path.join(resolveCarinaDataDir(), 'ops-agent-engine.json');

function defaultConfig(): AgentEngineConfig {
  const engineRaw = (process.env.CARINA_AGENT_ENGINE ?? process.env.AIVA_AGENT_ENGINE ?? '').trim().toLowerCase();
  const legacyKeprix = process.env.CARINA_KEPRIX_ENABLED === 'true';
  const global_engine: AgentEngineName =
    engineRaw === 'keprix' || engineRaw === 'carina'
      ? engineRaw
      : legacyKeprix
        ? 'keprix'
        : 'keprix';

  return {
    global_engine,
    keprix_url: (
      process.env.CARINA_KEPRIX_URL
      ?? process.env.KEPRIX_URL
      ?? 'http://127.0.0.1:3333'
    ).replace(/\/$/, ''),
    default_model: process.env.CARINA_KEPRIX_MODEL ?? 'deepseek-v4-pro',
    max_iterations: Number(process.env.CARINA_KEPRIX_MAX_ITERATIONS ?? 10) || 10,
    timeout_seconds: Number(process.env.CARINA_KEPRIX_TIMEOUT ?? 30) || 30,
    prompt_filter_enabled: process.env.CARINA_SCOUT_PROMPT_FILTER !== 'false',
    kill_switch_enabled: process.env.CARINA_SCOUT_KILL_SWITCH !== 'false',
    scout_integration_enabled: process.env.CARINA_SCOUT_INTEGRATION !== 'false',
  };
}

function emptyState(): AgentEngineState {
  return {
    config: defaultConfig(),
    workspaces: {},
    last_deploy: null,
    logs: [],
    audit: [],
    health_failures: 0,
    last_alert_at: null,
  };
}

function loadRaw(): AgentEngineState {
  try {
    const raw = fs.readFileSync(STATE_FILE(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AgentEngineState>;
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      config: { ...base.config, ...(parsed.config ?? {}) },
      workspaces: parsed.workspaces ?? {},
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      health_failures: Number(parsed.health_failures ?? 0) || 0,
      last_alert_at: parsed.last_alert_at ?? null,
      last_deploy: parsed.last_deploy ?? null,
    };
  } catch {
    return emptyState();
  }
}

function save(state: AgentEngineState): void {
  const dir = path.dirname(STATE_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function readAgentEngineState(): AgentEngineState {
  return loadRaw();
}

export function writeAgentEngineState(state: AgentEngineState): AgentEngineState {
  save(state);
  return state;
}

export function patchAgentEngineConfig(patch: Partial<AgentEngineConfig>): AgentEngineState {
  const state = loadRaw();
  state.config = { ...state.config, ...patch };
  if (patch.global_engine === 'keprix' || patch.global_engine === 'carina') {
    state.config.global_engine = patch.global_engine;
  }
  save(state);
  return state;
}

export function setWorkspaceEngine(
  id: string,
  engine: AgentEngineName,
  name?: string,
): AgentEngineState {
  const state = loadRaw();
  const prev = state.workspaces[id] ?? {};
  state.workspaces[id] = {
    ...prev,
    engine,
    name: name ?? prev.name ?? id,
    status: 'active',
  };
  save(state);
  return state;
}

export function setAllWorkspaceEngines(engine: AgentEngineName): AgentEngineState {
  const state = loadRaw();
  state.config.global_engine = engine;
  for (const id of Object.keys(state.workspaces)) {
    state.workspaces[id] = { ...state.workspaces[id], engine, status: 'active' };
  }
  save(state);
  return state;
}

export function appendAgentEngineLog(entry: AgentEngineLogEntry): void {
  const state = loadRaw();
  state.logs.unshift(entry);
  state.logs = state.logs.slice(0, 500);
  save(state);
}

export function appendAgentEngineAudit(entry: Omit<AgentEngineAuditEntry, 'at'> & { at?: string }): void {
  const state = loadRaw();
  state.audit.unshift({
    at: entry.at ?? new Date().toISOString(),
    action: entry.action,
    actor: entry.actor,
    details: entry.details ?? {},
  });
  state.audit = state.audit.slice(0, 200);
  save(state);
}

export function recordDeploy(
  action: string,
  status: string,
  estimated_downtime_seconds: number,
  detail?: string,
): AgentEngineState {
  const state = loadRaw();
  state.last_deploy = {
    action,
    status,
    at: new Date().toISOString(),
    estimated_downtime_seconds,
    detail,
  };
  save(state);
  return state;
}

export function updateHealthFailures(failures: number, lastAlertAt?: string | null): void {
  const state = loadRaw();
  state.health_failures = failures;
  if (lastAlertAt !== undefined) state.last_alert_at = lastAlertAt;
  save(state);
}

/** Test helper: reset state file. */
export function resetAgentEngineStateForTests(state?: Partial<AgentEngineState>): AgentEngineState {
  const next = { ...emptyState(), ...state, config: { ...emptyState().config, ...(state?.config ?? {}) } };
  save(next);
  return next;
}
