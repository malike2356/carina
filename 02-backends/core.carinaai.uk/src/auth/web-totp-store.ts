import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCarinaHome } from '../config/paths.js';

export interface WebTotpConfig {
  enabled: boolean;
  secret: string;
  enabledAt: string;
}

function configPath(): string {
  return path.join(resolveCarinaHome(), 'web-totp.json');
}

export function webTotpSecretFromEnv(): string | null {
  const raw = process.env.CARINA_WEB_TOTP_SECRET?.trim();
  return raw || null;
}

export async function readWebTotpConfig(): Promise<WebTotpConfig | null> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as WebTotpConfig;
    if (!parsed.enabled || !parsed.secret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWebTotpConfig(config: WebTotpConfig): Promise<void> {
  const dir = resolveCarinaHome();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export async function clearWebTotpConfig(): Promise<void> {
  await fs.unlink(configPath()).catch(() => undefined);
}

export async function resolveWebTotpSecret(): Promise<string | null> {
  const envSecret = webTotpSecretFromEnv();
  if (envSecret) return envSecret;
  const config = await readWebTotpConfig();
  return config?.secret ?? null;
}

export async function isWebTotpEnabled(): Promise<boolean> {
  if (webTotpSecretFromEnv()) return true;
  const config = await readWebTotpConfig();
  return Boolean(config?.enabled && config.secret);
}
