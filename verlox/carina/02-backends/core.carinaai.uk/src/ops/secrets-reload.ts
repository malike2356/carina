import fs from 'fs';
import { CARINA_ENV_PATH } from '../config/paths.js';
import { opsToken } from './ops-config.js';

export type SecretsReloadResult = {
  reloaded: string[];
  skipped: string[];
  gatewayNotified: boolean;
};

export function reloadEnvFromFile(
  envPath = CARINA_ENV_PATH,
  overwrite = true,
): { reloaded: string[]; skipped: string[] } {
  if (!fs.existsSync(envPath)) {
    return { reloaded: [], skipped: [] };
  }
  const parsed = fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const idx = trimmed.indexOf('=');
      if (idx < 0) return acc;
      acc[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
      return acc;
    }, {});

  const reloaded: string[] = [];
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!overwrite && process.env[key] !== undefined) {
      skipped.push(key);
      continue;
    }
    process.env[key] = value;
    reloaded.push(key);
  }
  return { reloaded, skipped };
}

export async function reloadCredentialPools(): Promise<void> {
  try {
    const { getCredentialPoolManager } = await import('../credentials/pool-manager.js');
    const { PROVIDER_DEFINITIONS } = await import('../brain/provider-registry.js');
    const mgr = getCredentialPoolManager();
    for (const def of PROVIDER_DEFINITIONS) {
      mgr.poolSize(def.name, process.env[def.apiKeyEnv] ?? '', process.env[def.apiKeysPoolEnv]);
    }
  } catch {
    // optional module
  }
}

export async function notifyGatewaySecretsReload(
  port = Number(process.env.WEB_PORT ?? '3000'),
): Promise<boolean> {
  const token = opsToken();
  if (!token) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/reload-secrets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function reloadSecrets(options: {
  overwrite?: boolean;
  notifyGateway?: boolean;
} = {}): Promise<SecretsReloadResult> {
  const { reloaded, skipped } = reloadEnvFromFile(CARINA_ENV_PATH, options.overwrite ?? true);
  await reloadCredentialPools();
  const { reloadBillingRuntime } = await import('../billing/billing-config.js');
  await reloadBillingRuntime().catch(() => undefined);
  let gatewayNotified = false;
  if (options.notifyGateway) {
    gatewayNotified = await notifyGatewaySecretsReload();
  }
  return { reloaded, skipped, gatewayNotified };
}
