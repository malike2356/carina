/**
 * Soft-wall escape hatches after free/trial managed allowance ends.
 * Operators configure these in ops → Free usage enforcement.
 */
import { resolveConfigValue } from './billing-config.js';

export type SoftWallAction = 'byok' | 'topup' | 'upgrade' | 'mini_llm';

const ACTION_KEYS: Record<SoftWallAction, string> = {
  byok: 'AIVA_SOFT_WALL_ALLOW_BYOK',
  topup: 'AIVA_SOFT_WALL_ALLOW_TOPUP',
  upgrade: 'AIVA_SOFT_WALL_ALLOW_UPGRADE',
  mini_llm: 'AIVA_SOFT_WALL_ALLOW_MINI_LLM',
};

function isEnabled(raw: string, defaultOn: boolean): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return defaultOn;
  if (['0', 'false', 'off', 'no', 'disabled'].includes(value)) return false;
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(value)) return true;
  return defaultOn;
}

/** Defaults: BYOK + top-up + upgrade on; mini LLM off until product route ships. */
export function resolveSoftWallActions(
  candidates: SoftWallAction[] = ['byok', 'topup', 'upgrade'],
): SoftWallAction[] {
  const defaults: Record<SoftWallAction, boolean> = {
    byok: true,
    topup: true,
    upgrade: true,
    mini_llm: false,
  };
  return candidates.filter((action) => {
    const key = ACTION_KEYS[action];
    return isEnabled(resolveConfigValue(key), defaults[action]);
  });
}

export function resolveCarinaFreeDailyMessages(fallback = 100): number {
  const raw = resolveConfigValue('CARINA_CLOUD_FREE_DAILY_MESSAGES').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 100_000 || !Number.isInteger(n)) return fallback;
  return n;
}

export function resolveCarinaFreeDailyTokens(fallback = 50_000): number {
  const raw = resolveConfigValue('CARINA_CLOUD_FREE_DAILY_TOKENS').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000 || n > 10_000_000 || !Number.isInteger(n)) return fallback;
  return n;
}

export function describeUsageGatePolicy(): {
  aivaTrialMessages: number;
  aivaTrialCreditGbp: string;
  aivaTrialDailyCapGbp: string;
  softWallActions: SoftWallAction[];
  carinaFreeDailyMessages: number;
  carinaFreeDailyTokens: number;
} {
  const msgRaw = resolveConfigValue('AIVA_TRIAL_MESSAGE_LIMIT').trim();
  const msg = Number(msgRaw);
  return {
    aivaTrialMessages: Number.isFinite(msg) && msg >= 1 ? Math.floor(msg) : 20,
    aivaTrialCreditGbp: resolveConfigValue('AIVA_TRIAL_CREDIT_GBP').trim() || '1',
    aivaTrialDailyCapGbp: resolveConfigValue('AIVA_TRIAL_DAILY_CAP_GBP').trim() || '2',
    softWallActions: resolveSoftWallActions(['byok', 'topup', 'upgrade', 'mini_llm']),
    carinaFreeDailyMessages: resolveCarinaFreeDailyMessages(),
    carinaFreeDailyTokens: resolveCarinaFreeDailyTokens(),
  };
}
