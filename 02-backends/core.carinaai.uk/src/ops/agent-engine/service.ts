/** Agent engine OPS service (C05). */

import {
  appendAgentEngineAudit,
  patchAgentEngineConfig,
  readAgentEngineState,
  recordDeploy,
  setAllWorkspaceEngines,
  setWorkspaceEngine,
} from './store.js';
import { deployKeprixAction, fetchKeprixHealth, fetchKeprixLogs } from './keprix-client.js';
import {
  fetchPhpWorkspaces,
  phpBridgeConfigured,
  syncPhpConfig,
  syncPhpGlobalEngine,
  syncPhpWorkspaceEngine,
} from './php-bridge.js';
import {
  noteEmergencyRollback,
  noteHealthResult,
  noteHighMemory,
  noteKillSwitchActivated,
} from './alerts.js';
import type {
  AgentEngineConfig,
  AgentEngineHealth,
  AgentEngineName,
  WorkspaceEngineAssignment,
} from './types.js';

function asEngine(value: unknown): AgentEngineName | null {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'keprix' || v === 'carina' ? v : null;
}

export async function getAgentEngineHealth(): Promise<AgentEngineHealth> {
  const state = readAgentEngineState();
  if (state.config.global_engine === 'carina') {
    const checked_at = new Date().toISOString();
    return {
      engine: 'carina',
      status: 'healthy',
      uptime_seconds: null,
      version: 'carina-native',
      active_sessions: null,
      memory_usage_mb: null,
      cpu_percent: null,
      last_error: null,
      checked_at,
    };
  }
  const health = await fetchKeprixHealth();
  await noteHealthResult(health.status === 'healthy');
  if (typeof health.memory_usage_mb === 'number' && health.memory_usage_mb > 0) {
    // Without total RAM we treat absolute MB heuristics lightly; prefer cpu/memory if percent present.
  }
  if (typeof health.cpu_percent === 'number' && health.cpu_percent >= 0) {
    // reserved for future thresholds
  }
  if (typeof health.raw?.memory_percent === 'number') {
    await noteHighMemory(Number(health.raw.memory_percent));
  }
  return health;
}

export function getAgentEngineConfig(): AgentEngineConfig {
  return readAgentEngineState().config;
}

export async function updateAgentEngineConfig(
  patch: Partial<AgentEngineConfig>,
  actor = 'ops-admin',
): Promise<AgentEngineConfig> {
  const next = patchAgentEngineConfig(patch);
  appendAgentEngineAudit({
    action: 'agent_engine.config_patch',
    actor,
    details: patch as Record<string, unknown>,
  });
  if (patch.global_engine) {
    await syncPhpGlobalEngine(patch.global_engine);
  }
  await syncPhpConfig(patch as Record<string, unknown>);
  return next.config;
}

export async function listAgentEngineWorkspaces(): Promise<{
  workspaces: WorkspaceEngineAssignment[];
  summary: { total: number; on_keprix: number; on_carina: number };
  source: 'php' | 'local';
}> {
  const php = await fetchPhpWorkspaces();
  if (php && php.length > 0) {
    const workspaces: WorkspaceEngineAssignment[] = php.map((w) => ({
      id: w.id,
      name: w.name,
      engine: w.engine,
      status: (w.status as WorkspaceEngineAssignment['status']) || 'active',
    }));
    return {
      workspaces,
      summary: summarize(workspaces),
      source: 'php',
    };
  }

  const state = readAgentEngineState();
  const workspaces: WorkspaceEngineAssignment[] = Object.entries(state.workspaces).map(([id, row]) => ({
    id,
    name: row.name ?? id,
    engine: row.engine,
    status: (row.status as WorkspaceEngineAssignment['status']) || 'active',
  }));

  // Always include a synthetic default row so OPS is never empty.
  if (workspaces.length === 0) {
    workspaces.push({
      id: 'default',
      name: 'Default / global',
      engine: state.config.global_engine,
      status: 'active',
    });
  }

  return {
    workspaces,
    summary: summarize(workspaces),
    source: 'local',
  };
}

function summarize(workspaces: WorkspaceEngineAssignment[]) {
  return {
    total: workspaces.length,
    on_keprix: workspaces.filter((w) => w.engine === 'keprix').length,
    on_carina: workspaces.filter((w) => w.engine === 'carina').length,
  };
}

export async function switchWorkspaceEngine(
  workspaceId: string,
  engineRaw: unknown,
  actor = 'ops-admin',
  name?: string,
): Promise<{ id: string; engine: AgentEngineName; php_sync: { ok: boolean; detail?: string } }> {
  const engine = asEngine(engineRaw);
  if (!engine) throw new Error('engine must be keprix or carina');
  setWorkspaceEngine(workspaceId, engine, name);
  appendAgentEngineAudit({
    action: 'agent_engine.workspace_switch',
    actor,
    details: { workspaceId, engine },
  });
  const php_sync = await syncPhpWorkspaceEngine(workspaceId, engine);
  return { id: workspaceId, engine, php_sync };
}

export async function emergencyRollbackToCarina(actor = 'ops-admin'): Promise<{
  engine: 'carina';
  php_sync: { ok: boolean; detail?: string };
}> {
  setAllWorkspaceEngines('carina');
  appendAgentEngineAudit({
    action: 'agent_engine.emergency_rollback',
    actor,
    details: { engine: 'carina' },
  });
  const php_sync = await syncPhpGlobalEngine('carina');
  await noteEmergencyRollback(actor);
  return { engine: 'carina', php_sync };
}

export async function deployAgentEngine(
  actionRaw: unknown,
  actor = 'ops-admin',
): Promise<{
  action: string;
  status: string;
  estimated_downtime_seconds: number;
  detail?: string;
}> {
  const action = String(actionRaw ?? '').trim().toLowerCase();
  if (action !== 'restart' && action !== 'update' && action !== 'rollback') {
    throw new Error('action must be restart, update, or rollback');
  }
  const result = await deployKeprixAction(action);
  recordDeploy(result.action, result.status, result.estimated_downtime_seconds, result.detail);
  appendAgentEngineAudit({
    action: `agent_engine.deploy_${action}`,
    actor,
    details: result,
  });
  return result;
}

export async function getAgentEngineLogs(level?: string, limit?: number) {
  return fetchKeprixLogs({ level, limit });
}

export function getAgentEngineMeta() {
  const state = readAgentEngineState();
  return {
    last_deploy: state.last_deploy,
    health_failures: state.health_failures,
    last_alert_at: state.last_alert_at,
    php_bridge_configured: phpBridgeConfigured(),
    audit: state.audit.slice(0, 20),
  };
}

export async function recordKillActivation(workspaceId: string, actor = 'ops-admin'): Promise<void> {
  appendAgentEngineAudit({
    action: 'agent_engine.kill_switch',
    actor,
    details: { workspaceId },
  });
  await noteKillSwitchActivated(workspaceId, actor);
}
