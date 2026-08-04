import os from 'os';
import path from 'path';

import type { AuxiliaryModelMap } from '../../types/auxiliary-model.js';
import type { FailoverConfig, ProviderProfile } from '../../providers/provider-profile.js';

export type ProviderName = 'deepseek' | 'anthropic' | 'openai' | 'gemini';

export type CliProviderConfig = {
  api_key?: string;
  model?: string;
};

export type CarinaCliConfig = {
  provider: ProviderName;
  model: string;
  dataDir: string;
  scout: {
    enabled: boolean;
    url: string;
  };
  providers: Record<ProviderName, CliProviderConfig>;
  auxiliaryModels?: AuxiliaryModelMap;
  skin?: string;
  providerProfiles?: ProviderProfile[];
  failover?: FailoverConfig;
};

export const DEFAULT_CLI_CONFIG: CarinaCliConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  dataDir: '~/.carina',
  scout: {
    enabled: false,
    url: '',
  },
  providers: {
    deepseek: { model: 'deepseek-chat' },
    anthropic: { model: 'claude-sonnet-4-6' },
    openai: { model: 'gpt-4o' },
    gemini: { model: 'gemini-2.0-flash' },
  },
};

export function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}
