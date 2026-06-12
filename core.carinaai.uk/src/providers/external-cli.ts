import { PROVIDER_DEFINITIONS, PROVIDER_MAP } from '../brain/provider-registry.js';

export interface ExternalCliProviderInfo {
  name: string;
  displayName: string;
  cliCommand: string;
  installNote: string;
  configEnv?: string;
}

const EXTERNAL_CLI_INFO: Record<string, ExternalCliProviderInfo> = {
  'openai-codex': {
    name: 'openai-codex',
    displayName: 'OpenAI Codex',
    cliCommand: 'codex',
    installNote: 'npm i -g @openai/codex',
    configEnv: 'OPENAI_API_KEY',
  },
  'github-copilot': {
    name: 'github-copilot',
    displayName: 'GitHub Copilot',
    cliCommand: 'gh copilot',
    installNote: 'gh extension install github/gh-copilot && gh auth login',
  },
  'github-copilot-acp': {
    name: 'github-copilot-acp',
    displayName: 'GitHub Copilot ACP',
    cliCommand: 'gh copilot',
    installNote: 'Requires gh CLI, Copilot subscription, and ACP-enabled IDE.',
  },
  'kilo-code': {
    name: 'kilo-code',
    displayName: 'Kilo Code',
    cliCommand: 'kilo',
    installNote: 'Install from kiloc.de',
    configEnv: 'KILO_CODE_API_KEY',
  },
  'opencode-zen': {
    name: 'opencode-zen',
    displayName: 'OpenCode Zen',
    cliCommand: 'opencode',
    installNote: 'Install from opencode.ai (Zen variant)',
  },
  'opencode-go': {
    name: 'opencode-go',
    displayName: 'OpenCode Go',
    cliCommand: 'opencode',
    installNote: 'Install from opencode.ai (Go build)',
  },
};

export function listExternalCliProviders(): ExternalCliProviderInfo[] {
  return Object.values(EXTERNAL_CLI_INFO);
}

export function getExternalCliInfo(name: string): ExternalCliProviderInfo | undefined {
  return EXTERNAL_CLI_INFO[name];
}

export function isExternalCliConfigured(name: string): boolean {
  const info = EXTERNAL_CLI_INFO[name];
  if (!info?.configEnv) return false;
  return Boolean(process.env[info.configEnv]);
}

export function listCatalogByStatus(
  status: 'active' | 'experimental' | 'external-cli' | 'oauth' | 'alias' | 'unsupported',
) {
  return PROVIDER_DEFINITIONS.filter((d) => d.status === status);
}

export function getProviderCatalogEntry(name: string) {
  return PROVIDER_MAP[name] ?? null;
}
