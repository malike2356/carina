import fs from 'fs';
import path from 'path';
import { globalCarinaHome } from '../config/paths.js';
import { getActiveProfileOrDefault } from './isolation.js';

export type DevIsolationWarning = {
  code: string;
  message: string;
  severity: 'warn' | 'fail';
};

const PROD_HOST_PATTERNS = [
  /\.propreneur\.uk$/i,
  /\.carinaai\.uk$/i,
  /production/i,
  /prod\./i,
];

const DEV_PROFILE_NAMES = new Set(['dev', 'development', 'local']);

export function isDevProfile(profileName?: string): boolean {
  const name = (profileName ?? getActiveProfileOrDefault()).toLowerCase();
  return DEV_PROFILE_NAMES.has(name) || name.endsWith('-dev');
}

export function devProfileHome(profileName?: string): string {
  const name = profileName ?? getActiveProfileOrDefault();
  return path.join(globalCarinaHome(), 'profiles', name);
}

export function assertDevProfileIsolation(profileName?: string): DevIsolationWarning[] {
  const warnings: DevIsolationWarning[] = [];
  if (!isDevProfile(profileName)) return warnings;

  const home = process.env.CARINA_HOME ?? globalCarinaHome();
  const expectedPrefix = devProfileHome(profileName);
  if (!home.startsWith(expectedPrefix) && !home.includes(`/profiles/${profileName ?? getActiveProfileOrDefault()}`)) {
    warnings.push({
      code: 'dev.home.leak',
      severity: 'warn',
      message: `dev profile CARINA_HOME (${home}) is not under profile directory (${expectedPrefix})`,
    });
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || !/_URL|_HOST|DATABASE_URL|REDIS_URL/i.test(key)) continue;
    if (PROD_HOST_PATTERNS.some((re) => re.test(value))) {
      warnings.push({
        code: 'dev.prod-endpoint',
        severity: 'fail',
        message: `dev profile references production endpoint in ${key}`,
      });
    }
  }

  const globalEnv = path.join(globalCarinaHome(), '.env');
  const profileEnv = path.join(expectedPrefix, '.env');
  if (fs.existsSync(globalEnv) && fs.existsSync(profileEnv)) {
    try {
      const globalRaw = fs.readFileSync(globalEnv, 'utf8');
      const profileRaw = fs.readFileSync(profileEnv, 'utf8');
      if (globalRaw === profileRaw) {
        warnings.push({
          code: 'dev.env.shared',
          severity: 'warn',
          message: 'dev profile .env is identical to global .env; use profile-scoped secrets',
        });
      }
    } catch {
      // optional
    }
  }

  return warnings;
}

export function bindDevProfileGuard(profileName?: string): void {
  const warnings = assertDevProfileIsolation(profileName);
  const fails = warnings.filter((w) => w.severity === 'fail');
  if (fails.length > 0 && process.env.CARINA_DEV_ISOLATION_STRICT === 'true') {
    throw new Error(fails.map((w) => w.message).join('; '));
  }
  if (warnings.length > 0 && process.env.CARINA_DEV_ISOLATION_QUIET !== 'true') {
    for (const w of warnings) {
      console.warn(`[dev-isolation] ${w.code}: ${w.message}`);
    }
  }
}
