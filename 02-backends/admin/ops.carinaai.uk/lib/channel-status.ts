import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { resolveCoreEnvPath } from './core-env.js';

export type ChannelHealthState =
  | 'connected'
  | 'configured'
  | 'partial'
  | 'disabled'
  | 'unsupported'
  | 'error';

export type ChannelStatusReport = {
  channel: string;
  name?: string;
  state: ChannelHealthState;
  active: boolean;
  transport?: string;
  reason?: string;
  notes?: string;
  webhook?: string;
  env: string[];
};

export type ChannelPolicyFlags = Record<string, boolean>;

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
let __opsDir = path.dirname(__moduleDir);
if (path.basename(__opsDir) === 'dist') {
  __opsDir = path.dirname(__opsDir);
}

function coreRootCandidates(): string[] {
  const fromEnv = process.env.CARINA_CORE_ROOT?.trim();
  return [
    ...(fromEnv ? [fromEnv] : []),
    '/host/core',
    '/home/malike/apps/core.carinaai.uk',
    path.resolve(__opsDir, '../core.carinaai.uk'),
    path.resolve(__opsDir, '../../core.carinaai.uk'),
    path.resolve(__opsDir, '../../servers/core.carinaai.uk'),
  ];
}

function resolveCoreChannelStatusModule(): string | null {
  const relativePaths = [
    'dist/src/gateway/channels/channel-status.js',
    'dist/gateway/channels/channel-status.js',
  ];
  for (const root of coreRootCandidates()) {
    for (const rel of relativePaths) {
      const candidate = path.join(root, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export async function fetchChannelStatusReports(): Promise<{
  channels: ChannelStatusReport[];
  policyFlags: ChannelPolicyFlags;
  source: string;
}> {
  const modulePath = resolveCoreChannelStatusModule();
  if (!modulePath) {
    return {
      channels: [],
      policyFlags: {},
      source: 'unavailable (set CARINA_CORE_ROOT or mount /host/core)',
    };
  }
  dotenv.config({ path: resolveCoreEnvPath() });
  const mod = await import(pathToFileURL(modulePath).href) as {
    getChannelStatusReports: () => ChannelStatusReport[];
    getChannelPolicyFlags: () => ChannelPolicyFlags;
  };
  const channels = (mod.getChannelStatusReports() ?? []).map((row) => ({
    ...row,
    name: row.name || row.channel,
    notes: row.notes || row.reason || '',
  }));
  return {
    channels,
    policyFlags: mod.getChannelPolicyFlags?.() ?? {},
    source: modulePath,
  };
}
