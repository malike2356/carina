import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVIDER_MAP } from '../../brain/provider-registry.js';
import type { SecretRotationPolicy, SecretType } from './types.js';
import { policiesPath, schedulesPath } from './paths.js';

const DAY_MS = 86_400_000;

export function parseDuration(value: string): number {
  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === 'ms') return amount;
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60_000;
  if (unit === 'h') return amount * 3_600_000;
  return amount * DAY_MS;
}

function defaultPolicyForProvider(provider: string): SecretRotationPolicy {
  const def = PROVIDER_MAP[provider];
  return {
    provider,
    secretType: 'api_key',
    envKey: def?.apiKeyEnv,
    maxAgeMs: 90 * DAY_MS,
    rotationWindowMs: 5 * 60_000,
    autoRotate: false,
    notifyBeforeMs: 7 * DAY_MS,
  };
}

export const DEFAULT_ROTATION_POLICIES: SecretRotationPolicy[] = Object.keys(PROVIDER_MAP)
  .slice(0, 12)
  .map((provider) => defaultPolicyForProvider(provider));

export async function loadPolicies(): Promise<SecretRotationPolicy[]> {
  try {
    const raw = JSON.parse(await fs.readFile(policiesPath(), 'utf8')) as { policies?: SecretRotationPolicy[] };
    if (Array.isArray(raw.policies) && raw.policies.length > 0) return raw.policies;
  } catch {
    // fall through
  }
  return DEFAULT_ROTATION_POLICIES;
}

export async function savePolicies(policies: SecretRotationPolicy[]): Promise<void> {
  await fs.mkdir(path.dirname(policiesPath()), { recursive: true });
  await fs.writeFile(policiesPath(), JSON.stringify({ policies }, null, 2), { mode: 0o600 });
}

export async function getPolicy(provider: string): Promise<SecretRotationPolicy> {
  const policies = await loadPolicies();
  return policies.find((row) => row.provider === provider) ?? defaultPolicyForProvider(provider);
}

export type RotationSchedule = {
  provider: string;
  nextRunAt: number;
  cronHint: string;
};

export async function saveSchedule(schedule: RotationSchedule): Promise<void> {
  const filePath = schedulesPath();
  let schedules: RotationSchedule[] = [];
  try {
    schedules = JSON.parse(await fs.readFile(filePath, 'utf8')) as RotationSchedule[];
  } catch {
    schedules = [];
  }
  const index = schedules.findIndex((row) => row.provider === schedule.provider);
  if (index >= 0) schedules[index] = schedule;
  else schedules.push(schedule);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(schedules, null, 2), { mode: 0o600 });
}

export function computeSchedule(policy: SecretRotationPolicy): string {
  const days = Math.max(1, Math.round(policy.maxAgeMs / DAY_MS));
  return `every ${days} days`;
}

export function inferSecretType(envKey: string): SecretType {
  if (/oauth|refresh/i.test(envKey)) return 'oauth_token';
  if (/jwt/i.test(envKey)) return 'jwt';
  if (/session/i.test(envKey)) return 'session_token';
  if (/encryption|master[_-]?key/i.test(envKey)) return 'encryption_key';
  return 'api_key';
}
