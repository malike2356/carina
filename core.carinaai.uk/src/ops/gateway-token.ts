import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import { appendEnvValue } from '../cli/config/loader.js';

const MIN_TOKEN_LENGTH = 24;

function envFilePath(): string {
  return path.join(resolveCarinaHome(), '.env');
}

export function generateGatewayOpsToken(): string {
  return `cop_${crypto.randomBytes(32).toString('base64url')}`;
}

export function readEnvKey(key: string, envPath = envFilePath()): string | null {
  if (!fs.existsSync(envPath)) return null;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    if (trimmed.slice(0, idx) === key) {
      return trimmed.slice(idx + 1);
    }
  }
  return null;
}

export function gatewayOpsTokenStatus(): {
  configured: boolean;
  source: 'ops-token' | 'web-password' | 'none';
  length: number;
  weak: boolean;
} {
  const ops = process.env.CARINA_OPS_TOKEN ?? readEnvKey('CARINA_OPS_TOKEN') ?? '';
  const web = process.env.CARINA_WEB_PASSWORD ?? readEnvKey('CARINA_WEB_PASSWORD') ?? '';
  const token = ops || web;
  const source = ops ? 'ops-token' : web ? 'web-password' : 'none';
  return {
    configured: token.length > 0,
    source,
    length: token.length,
    weak: token.length > 0 && token.length < MIN_TOKEN_LENGTH,
  };
}

export async function ensureGatewayOpsToken(options: { force?: boolean } = {}): Promise<{
  created: boolean;
  token?: string;
  path: string;
}> {
  const status = gatewayOpsTokenStatus();
  if (status.configured && !status.weak && !options.force) {
    return { created: false, path: envFilePath() };
  }
  const token = generateGatewayOpsToken();
  await appendEnvValue('CARINA_OPS_TOKEN', token);
  process.env.CARINA_OPS_TOKEN = token;
  return { created: true, token, path: envFilePath() };
}
