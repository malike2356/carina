import os from 'os';
import path from 'path';

import type { AuxiliaryModelMap } from '../../types/auxiliary-model.js';

export type ProviderName = 'deepseek' | 'anthropic' | 'openai';

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
  },
};

export function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}
