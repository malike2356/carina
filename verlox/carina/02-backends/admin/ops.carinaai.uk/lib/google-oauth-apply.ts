import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { carinaGet, carinaPost } from './carina.js';

const execFileAsync = promisify(execFile);

const HOST_CORE = process.env.CARINA_GOOGLE_OAUTH_CORE_DIR?.trim()
  || (existsSync('/host/core') ? '/host/core' : '/home/malike/apps/core.carinaai.uk');
const HOST_APP = process.env.CARINA_GOOGLE_OAUTH_APP_DIR?.trim()
  || (existsSync('/host/app') ? '/host/app' : '/home/malike/apps/app.carinaai.uk');

export const GOOGLE_OAUTH_REDIRECT_URIS = [
  'https://app.carinaai.uk/api/auth/callback/google',
  'https://admin.hireaiva.co.uk/api/auth/callback/google',
  'https://app.carinaai.uk/api/aiva/tools/oauth/google/callback',
  'https://app.carinaai.uk/api/aiva/email/oauth/gmail/callback',
  'http://localhost:4100/api/auth/callback/google',
] as const;

export type GoogleOAuthStatus = {
  configured: boolean;
  clientIdSet: boolean;
  clientSecretSet: boolean;
  clientIdHint?: string;
  driveToolsReady?: boolean;
  signInReady?: boolean;
  redirectUris: string[];
  source?: string;
  error?: string;
};

function upsertEnvText(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

/** Write key=value into a host file via temporary docker volume (works when mount is ro). */
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
      // fall through to docker helper (read-only mounts inside ops)
    }
  }

  let content = '';
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['run', '--rm', '-v', `${hostPath}:/env:ro`, 'alpine:3.20', 'cat', '/env'],
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
      `${hostPath}:/env:rw`,
      'alpine:3.20',
      'sh',
      '-c',
      `touch /env && printf '%s' '${b64}' | base64 -d > /env`,
    ],
    { timeout: 60_000 },
  );
}

async function recreateGoogleOAuthServices(): Promise<{ ok: boolean; error?: string }> {
  try {
    await execFileAsync(
      'docker',
      [
        'compose',
        '-f', `${HOST_CORE}/docker-compose.prod.yml`,
        '-f', `${HOST_CORE}/docker-compose.deploy.yml`,
        '--project-directory', HOST_CORE,
        'up', '-d', '--force-recreate', '--no-deps',
        'carina-web',
        'carina-cloud',
      ],
      { timeout: 180_000, cwd: HOST_CORE },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function clientIdHint(id: string): string | undefined {
  if (!id) return undefined;
  if (id.length <= 12) return 'set';
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function readEnvValue(filePath: string, key: string): string {
  try {
    if (!existsSync(filePath)) return '';
    const match = readFileSync(filePath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

function statusFromHostEnvFiles(): GoogleOAuthStatus | null {
  const paths = [
    `${HOST_APP}/.env`,
    `${HOST_CORE}/.env.cloud.runtime`,
    `${HOST_CORE}/.env.docker.runtime`,
  ];
  for (const path of paths) {
    const id =
      readEnvValue(path, 'GOOGLE_CLIENT_ID')
      || readEnvValue(path, 'GOOGLE_OAUTH_CLIENT_ID');
    const secret =
      readEnvValue(path, 'GOOGLE_CLIENT_SECRET')
      || readEnvValue(path, 'GOOGLE_OAUTH_CLIENT_SECRET');
    if (id && secret && id.includes('.apps.googleusercontent.com')) {
      return {
        configured: true,
        clientIdSet: true,
        clientSecretSet: true,
        clientIdHint: clientIdHint(id),
        driveToolsReady: true,
        signInReady: true,
        redirectUris: [...GOOGLE_OAUTH_REDIRECT_URIS],
        source: 'env',
      };
    }
  }
  return null;
}

export async function fetchGoogleOAuthStatus(): Promise<GoogleOAuthStatus> {
  try {
    const response = await carinaGet('/api/ops/google-oauth');
    if (response.ok) {
      const body = (await response.json()) as GoogleOAuthStatus;
      if (body.configured) {
        return {
          ...body,
          redirectUris: body.redirectUris?.length ? body.redirectUris : [...GOOGLE_OAUTH_REDIRECT_URIS],
        };
      }
    }
  } catch {
    // Fall through to host env files.
  }

  const fromFiles = statusFromHostEnvFiles();
  if (fromFiles) return fromFiles;

  return {
    configured: false,
    clientIdSet: false,
    clientSecretSet: false,
    redirectUris: [...GOOGLE_OAUTH_REDIRECT_URIS],
    source: 'none',
  };
}

export async function applyGoogleOAuthCredentials(input: {
  clientId: string;
  clientSecret: string;
  restartServices?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  coreSaved?: boolean;
  filesUpdated?: string[];
  restarted?: boolean;
  restartError?: string;
}> {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId) return { ok: false, error: 'Client ID is required' };
  if (!clientSecret) return { ok: false, error: 'Client secret is required (paste the full secret)' };
  if (clientId.includes('@') || !clientId.includes('.apps.googleusercontent.com')) {
    return {
      ok: false,
      error: 'Client ID looks wrong. Paste the OAuth Client ID ending in .apps.googleusercontent.com, not a Gmail address.',
    };
  }

  const coreRes = await carinaPost('/api/ops/google-oauth', {
    clientId,
    clientSecret,
  });
  if (!coreRes.ok) {
    const text = await coreRes.text();
    return { ok: false, error: `Core save failed (HTTP ${coreRes.status}): ${text.slice(0, 200)}` };
  }

  const updates: Record<string, string> = {
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_OAUTH_CLIENT_ID: clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
    AIVA_APP_URL: 'https://app.carinaai.uk',
    AIVA_GOOGLE_TOOLS_OAUTH_REDIRECT_URI:
      'https://app.carinaai.uk/api/aiva/tools/oauth/google/callback',
  };

  const filesUpdated: string[] = [];
  const targets = [
    `${HOST_CORE}/.env.docker.runtime`,
    `${HOST_CORE}/.env.cloud.runtime`,
    `${HOST_APP}/.env`,
  ];
  for (const target of targets) {
    try {
      await upsertHostEnvFile(target, updates);
      filesUpdated.push(target);
    } catch (err) {
      return {
        ok: false,
        error: `Saved to Core but failed writing ${target}: ${err instanceof Error ? err.message : String(err)}`,
        coreSaved: true,
        filesUpdated,
      };
    }
  }

  if (input.restartServices === false) {
    return { ok: true, coreSaved: true, filesUpdated, restarted: false };
  }

  const restart = await recreateGoogleOAuthServices();
  return {
    ok: restart.ok,
    coreSaved: true,
    filesUpdated,
    restarted: restart.ok,
    restartError: restart.error,
    error: restart.ok ? undefined : `Credentials saved, but service restart failed: ${restart.error}`,
  };
}
