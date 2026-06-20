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
  state: ChannelHealthState;
  active: boolean;
  transport?: string;
  reason?: string;
  webhook?: string;
  env: string[];
};

export type ChannelPolicyFlags = Record<string, boolean>;

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
let __opsDir = path.dirname(__moduleDir);
if (path.basename(__opsDir) === 'dist') {
  __opsDir = path.dirname(__opsDir);
}

function resolveCoreChannelStatusModule(): string {
  const coreRoot = path.resolve(__opsDir, '../core.carinaai.uk');
  const distModule = path.join(coreRoot, 'dist/gateway/channels/channel-status.js');
  if (fs.existsSync(distModule)) return distModule;
  return path.join(coreRoot, 'src/gateway/channels/channel-status.ts');
}

// Reuses core getChannelStatusReports(); loads core .env and imports compiled dist when present, else TS source under tsx.
export async function fetchChannelStatusReports(): Promise<{
  channels: ChannelStatusReport[];
  policyFlags: ChannelPolicyFlags;
}> {
  dotenv.config({ path: resolveCoreEnvPath() });
  const modulePath = resolveCoreChannelStatusModule();
  const mod = await import(pathToFileURL(modulePath).href) as {
    getChannelStatusReports: () => ChannelStatusReport[];
    getChannelPolicyFlags: () => ChannelPolicyFlags;
  };
  return {
    channels: mod.getChannelStatusReports(),
    policyFlags: mod.getChannelPolicyFlags(),
  };
}
