import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { carinaGet, carinaJson, carinaPost } from './carina.js';

const execFileAsync = promisify(execFile);

const HOST_CORE = process.env.CARINA_COMPANIES_HOUSE_CORE_DIR?.trim()
  || process.env.CARINA_GOOGLE_OAUTH_CORE_DIR?.trim()
  || (existsSync('/host/core') ? '/host/core' : '/home/malike/apps/core.carinaai.uk');

const DOMAIN_ID = 'integration:companies-house';

export type CompaniesHouseStatus = {
  configured: boolean;
  keyPresent: boolean;
  keyHint?: string;
  source: 'core' | 'host' | 'none';
  hubUrl?: string;
  error?: string;
};

function upsertEnvText(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

async function upsertHostEnvFile(hostPath: string, updates: Record<string, string>): Promise<void> {
  if (existsSync(hostPath)) {
    let content = readFileSync(hostPath, 'utf8');
    for (const [key, value] of Object.entries(updates)) {
      content = upsertEnvText(content, key, value);
    }
    writeFileSync(hostPath, content, { encoding: 'utf8', mode: 0o600 });
    return;
  }
  // Fallback: docker run alpine write via volume (same pattern as Google OAuth)
  const dir = hostPath.includes('/') ? hostPath.slice(0, hostPath.lastIndexOf('/')) : '.';
  const base = hostPath.includes('/') ? hostPath.slice(hostPath.lastIndexOf('/') + 1) : hostPath;
  let content = '';
  try {
    const { stdout } = await execFileAsync('docker', [
      'run', '--rm', '-v', `${dir}:/envdir`, 'alpine:3.20',
      'sh', '-c', `cat /envdir/${base} 2>/dev/null || true`,
    ]);
    content = stdout;
  } catch {
    content = '';
  }
  for (const [key, value] of Object.entries(updates)) {
    content = upsertEnvText(content, key, value);
  }
  await execFileAsync('docker', [
    'run', '--rm', '-i', '-v', `${dir}:/envdir`, 'alpine:3.20',
    'sh', '-c', `cat > /envdir/${base} && chmod 600 /envdir/${base}`,
  ], { input: content } as never);
}

function hintFromKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 8) return '(set)';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export async function fetchCompaniesHouseStatus(): Promise<CompaniesHouseStatus> {
  const hubUrl = 'https://developer.company-information.service.gov.uk/';
  try {
    const response = await carinaGet(`/api/internal/settings/${encodeURIComponent(DOMAIN_ID)}`, 8000);
    const parsed = await carinaJson<{
      fields?: Array<{ key: string; currentValue?: string; isSet?: boolean }>;
    }>(response);
    if (parsed.ok) {
      const field = parsed.data?.fields?.find((f) => f.key === 'COMPANIES_HOUSE_API_KEY');
      const raw = field?.currentValue ?? '';
      const keyPresent = Boolean(field?.isSet) || (raw !== '' && raw !== '[not set]');
      return {
        configured: keyPresent,
        keyPresent,
        keyHint: keyPresent ? (raw === '[set]' ? '(set)' : hintFromKey(raw)) : undefined,
        source: keyPresent ? 'core' : 'none',
        hubUrl,
      };
    }
  } catch {
    /* fall through to host file */
  }

  const runtimePath = `${HOST_CORE}/.env.docker.runtime`;
  if (existsSync(runtimePath)) {
    const content = readFileSync(runtimePath, 'utf8');
    const match = content.match(/^COMPANIES_HOUSE_API_KEY=(.*)$/m);
    if (match?.[1]?.trim()) {
      return {
        configured: true,
        keyPresent: true,
        keyHint: hintFromKey(match[1].trim()),
        source: 'host',
        hubUrl,
      };
    }
  }

  return { configured: false, keyPresent: false, source: 'none', hubUrl };
}

export async function applyCompaniesHouseKey(input: {
  apiKey: string;
  restartServices?: boolean;
}): Promise<{
  ok: boolean;
  coreSaved: boolean;
  hostSaved: boolean;
  restarted?: boolean;
  error?: string;
}> {
  const apiKey = input.apiKey.trim();
  let coreSaved = false;
  let hostSaved = false;

  try {
    const response = await carinaPost(
      `/api/internal/settings/${encodeURIComponent(DOMAIN_ID)}`,
      { values: { COMPANIES_HOUSE_API_KEY: apiKey } },
      15000,
    );
    const parsed = await carinaJson<{ ok?: boolean; error?: string }>(response);
    coreSaved = Boolean(parsed.ok && response.ok);
    if (!coreSaved) {
      return {
        ok: false,
        coreSaved: false,
        hostSaved: false,
        error: parsed.error ?? `Core settings save HTTP ${response.status}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      coreSaved: false,
      hostSaved: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    await upsertHostEnvFile(`${HOST_CORE}/.env.docker.runtime`, {
      COMPANIES_HOUSE_API_KEY: apiKey,
      COMPANIES_HOUSE_BASE_URL: 'https://api.company-information.service.gov.uk',
    });
    hostSaved = true;
  } catch (err) {
    return {
      ok: true,
      coreSaved,
      hostSaved: false,
      error: `Saved in Core DB but host env write failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let restarted = false;
  if (input.restartServices) {
    try {
      await execFileAsync('docker', ['compose', '-f', 'docker-compose.prod.yml', 'up', '-d', '--force-recreate', 'carina-web'], {
        cwd: HOST_CORE,
        timeout: 180_000,
      });
      restarted = true;
    } catch (err) {
      return {
        ok: true,
        coreSaved,
        hostSaved,
        restarted: false,
        error: `Key saved; recreate carina-web failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { ok: true, coreSaved, hostSaved, restarted };
}
