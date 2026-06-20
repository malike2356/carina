import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import { auditSecrets, type SecretFinding, type SecretsAuditReport } from './secrets-audit.js';

export type EnvironmentSettingSummary = {
  key: string;
  value: string;
  source: 'process' | 'derived';
  sensitive: boolean;
};

export type EnvironmentSummary = {
  generatedAt: string;
  carinaHome: string;
  envPath: string;
  envExists: boolean;
  envMode: string | null;
  settings: EnvironmentSettingSummary[];
  audit: SecretsAuditReport['summary'];
  findings: SecretFinding[];
  precedenceDrift: string[];
  unresolvedRefs: string[];
};

const PUBLIC_SETTINGS = [
  'CARINA_HOME',
  'CARINA_PROFILE',
  'WEB_PORT',
  'WEB_ENABLED',
  'LABYRINTH_ENABLED',
  'SCOUT_ENABLED',
  'CARINA_LOCAL_MODE',
  'DEFAULT_PROVIDER',
  'DEFAULT_MODEL',
] as const;

const SENSITIVE_SETTINGS = [
  'DATABASE_URL',
  'REDIS_URL',
  'DEEPSEEK_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'DISCORD_BOT_TOKEN',
  'SLACK_BOT_TOKEN',
] as const;

function fileMode(envPath: string): string | null {
  try {
    return (fs.statSync(envPath).mode & 0o777).toString(8);
  } catch {
    return null;
  }
}

function valueFor(key: string, sensitive: boolean): string {
  if (sensitive) {
    return process.env[key] ? 'set' : 'unset';
  }
  if (key === 'CARINA_HOME') return resolveCarinaHome();
  return process.env[key]?.trim() || 'unset';
}

export function buildEnvironmentSummary(): EnvironmentSummary {
  const carinaHome = resolveCarinaHome();
  const envPath = path.join(carinaHome, '.env');
  const settings: EnvironmentSettingSummary[] = [];

  for (const key of PUBLIC_SETTINGS) {
    settings.push({
      key,
      value: valueFor(key, false),
      source: 'process',
      sensitive: false,
    });
  }

  for (const key of SENSITIVE_SETTINGS) {
    settings.push({
      key,
      value: valueFor(key, true),
      source: 'process',
      sensitive: true,
    });
  }

  const audit = auditSecrets({ includeProcessEnv: true });

  return {
    generatedAt: new Date().toISOString(),
    carinaHome,
    envPath,
    envExists: fs.existsSync(envPath),
    envMode: fileMode(envPath),
    settings,
    audit: audit.summary,
    findings: audit.findings,
    precedenceDrift: audit.precedenceDrift,
    unresolvedRefs: audit.unresolvedRefs,
  };
}
