import { config } from '../config/index.js';

export type ScoutDeploymentMode = 'colocated' | 'distributed' | 'carina_only';

function normaliseMode(raw: string): ScoutDeploymentMode | null {
  const value = raw.trim().toLowerCase().replace(/-/g, '_');
  if (value === 'colocated') return 'colocated';
  if (value === 'distributed') return 'distributed';
  if (value === 'carina_only' || value === 'disabled' || value === 'off') return 'carina_only';
  return null;
}

/** Resolve deployment mode from SCOUT_MODE (prompt 34). */
export function resolveScoutMode(): ScoutDeploymentMode {
  const explicit = process.env.SCOUT_MODE ? normaliseMode(process.env.SCOUT_MODE) : null;
  if (explicit) return explicit;
  if (process.env.SCOUT_ENABLED === 'false' && process.env.LABYRINTH_ENABLED !== 'true') {
    return 'carina_only';
  }
  return 'colocated';
}

export function isScoutColocated(): boolean {
  return resolveScoutMode() === 'colocated';
}

export function isScoutDistributed(): boolean {
  return resolveScoutMode() === 'distributed';
}

export function isScoutCarinaOnly(): boolean {
  return resolveScoutMode() === 'carina_only';
}

/** True when Carina should emit signals and listen for Scout commands. */
export function isScoutMutualIntegrationActive(): boolean {
  if (isScoutCarinaOnly()) return false;
  return config.scout.enabled;
}

/** True when Redis kill-switch listener should subscribe (works without Scout HTTP API). */
export function isScoutControlPlaneActive(): boolean {
  if (isScoutCarinaOnly()) return false;
  return config.labyrinth.enabled && Boolean(config.labyrinth.instanceId);
}

export function scoutEndpointUrl(): string {
  if (isScoutDistributed() && config.scout.endpoint) {
    return config.scout.endpoint.replace(/\/+$/, '');
  }
  return config.labyrinth.url.replace(/\/+$/, '');
}
