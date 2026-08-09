import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HOST_CORE = process.env.CARINA_EMAIL_INGESTION_CORE_DIR?.trim()
  || process.env.CARINA_GOOGLE_OAUTH_CORE_DIR?.trim()
  || (existsSync('/host/core') ? '/host/core' : '/home/malike/apps/core.carinaai.uk');
const HOST_CORE_DOCKER = process.env.CARINA_EMAIL_INGESTION_HOST_CORE_DIR?.trim()
  || process.env.CARINA_GOOGLE_OAUTH_CORE_DIR?.trim()
  || '/home/malike/apps/core.carinaai.uk';

const CORE_SERVICE = 'carina-cloud';

export type GlobalEmailIngestionStatus = {
  enabled: boolean;
  envPath: string;
  source: 'env' | 'host' | 'none';
};

function upsertEnvText(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

function readEnvValue(filePath: string, key: string): string {
  try {
    if (!existsSync(filePath)) return '';
    const match = readFileSync(filePath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  } catch {
    return '';
  }
}

async function upsertHostEnvFile(hostPath: string, updates: Record<string, string>): Promise<void> {
  if (existsSync(hostPath)) {
    try {
      let content = readFileSync(hostPath, 'utf8');
      for (const [key, value] of Object.entries(updates)) {
        content = upsertEnvText(content, key, value);
      }
      writeFileSync(hostPath, content, { encoding: 'utf8', mode: 0o600 });
      return;
    } catch {
      // fall through to docker helper for read-only mounts
    }
  }

  let content = '';
  const mountSource = hostPath.startsWith('/host/core')
    ? hostPath.replace('/host/core', HOST_CORE_DOCKER)
    : hostPath.startsWith('/host/app')
      ? hostPath.replace('/host/app', '/home/malike/apps/app.carinaai.uk')
      : hostPath;
  const hostDir = path.dirname(mountSource);
  const hostFile = path.basename(mountSource);

  try {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${hostDir}:/envdir:ro`,
        'alpine:3.20',
        'sh',
        '-c',
        `cat /envdir/${hostFile}`,
      ],
      { timeout: 30_000 },
    );
    content = stdout;
  } catch {
    content = '';
  }

  for (const [key, value] of Object.entries(updates)) {
    content = upsertEnvText(content, key, value);
  }

  const b64 = Buffer.from(content, 'utf8').toString('base64');
  await execFileAsync(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${hostDir}:/envdir:rw`,
      'alpine:3.20',
      'sh',
      '-c',
      `printf '%s' '${b64}' | base64 -d > /envdir/${hostFile}`,
    ],
    { timeout: 60_000 },
  );
}

async function restartCoreCloud(): Promise<{ ok: boolean; error?: string }> {
  try {
    await execFileAsync(
      'docker',
      [
        'compose',
        '-f',
        `${HOST_CORE}/docker-compose.prod.yml`,
        '-f',
        `${HOST_CORE}/docker-compose.deploy.yml`,
        '--project-directory',
        HOST_CORE,
        'up',
        '-d',
        '--force-recreate',
        '--no-deps',
        CORE_SERVICE,
      ],
      { timeout: 180_000, cwd: HOST_CORE },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function getGlobalEmailIngestionStatus(): GlobalEmailIngestionStatus {
  const envPath = `${HOST_CORE}/.env.docker.runtime`;
  const enabled = readEnvValue(envPath, 'EMAIL_INGESTION_ENABLED') === 'true';
  if (existsSync(envPath)) {
    return { enabled, envPath, source: 'host' };
  }
  if (process.env.EMAIL_INGESTION_ENABLED?.trim()) {
    return { enabled: process.env.EMAIL_INGESTION_ENABLED === 'true', envPath, source: 'env' };
  }
  return { enabled: false, envPath, source: 'none' };
}

export async function applyGlobalEmailIngestionEnabled(input: {
  enabled: boolean;
}): Promise<{
  ok: boolean;
  saved?: boolean;
  restarted?: boolean;
  error?: string;
  restartError?: string;
  status?: GlobalEmailIngestionStatus;
}> {
  const envPath = `${HOST_CORE}/.env.docker.runtime`;
  const value = input.enabled ? 'true' : 'false';

  try {
    await upsertHostEnvFile(envPath, { EMAIL_INGESTION_ENABLED: value });
  } catch (err) {
    return {
      ok: false,
      error: `Failed to update core env: ${err instanceof Error ? err.message : String(err)}`,
      status: getGlobalEmailIngestionStatus(),
    };
  }

  process.env.EMAIL_INGESTION_ENABLED = value;
  const status = getGlobalEmailIngestionStatus();

  const restart = await restartCoreCloud();
  if (!restart.ok) {
    return {
      ok: false,
      saved: true,
      restarted: false,
      restartError: restart.error,
      status,
      error: `Saved, but core restart failed: ${restart.error}`,
    };
  }

  return {
    ok: true,
    saved: true,
    restarted: true,
    status,
  };
}
