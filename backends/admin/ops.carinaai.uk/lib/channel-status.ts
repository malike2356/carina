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

function resolveCoreChannelStatusModule(): string | null {
  const coreRoot = path.resolve(__opsDir, '../core.carinaai.uk');
  const distModule = path.join(coreRoot, 'dist/gateway/channels/channel-status.js');
  if (fs.existsSync(distModule)) return distModule;
  return null;
}

export async function fetchChannelStatusReports(): Promise<{
  channels: ChannelStatusReport[];
  policyFlags: ChannelPolicyFlags;
}> {
  const modulePath = resolveCoreChannelStatusModule();
  if (!modulePath) {
    return { channels: [], policyFlags: {} };
  }
  dotenv.config({ path: resolveCoreEnvPath() });
  const mod = await import(pathToFileURL(modulePath).href) as {
    getChannelStatusReports: () => ChannelStatusReport[];
    getChannelPolicyFlags: () => ChannelPolicyFlags;
  };
  return {
    channels: mod.getChannelStatusReports(),
    policyFlags: mod.getChannelPolicyFlags(),
  };
}
