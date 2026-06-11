import { KNOWN_LLM_PROVIDERS } from '../brain/provider-registry.js';
import { PLATFORM_NAMES, TOOLSET_NAMES } from '../tools/toolset-config.js';

export const TOP_LEVEL_COMMANDS = [
  'chat', 'tui', 'setup', 'serve', 'mcp', 'web', 'config', 'model', 'tools', 'profile',
  'personality', 'agents', 'host', 'gateway', 'channels', 'whatsapp', 'pairing', 'cron', 'doctor',
  'logs', 'skills', 'packs', 'install-pack', 'list-packs', 'memory', 'sessions',
  'checkpoint', 'rag', 'backup', 'commitments', 'ops', 'providers', 'scout', 'security', 'tenant',
  'billing', 'plugins', 'hooks', 'migrate', 'update', 'ingest', 'hub', 'contacts',
  'secrets', 'credentials', 'curator', 'kanban', 'env', 'completion', 'ide', 'help', 'version',
] as const;

export const CHANNEL_NAMES = [
  'telegram', 'whatsapp', 'web', 'discord', 'slack', 'sms', 'signal', 'matrix',
  'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
  'homeassistant', 'api', 'webhooks', 'cli',
] as const;

export { TOOLSET_NAMES };

export const SUBCOMMANDS: Record<string, readonly string[]> = {
  config: ['list', 'show', 'get', 'set', 'unset', 'edit', 'check', 'migrate'],
  model: ['menu', 'list', 'set', 'pick', 'current', 'test'],
  tools: ['menu', 'list', 'toolsets', 'platform', 'enable', 'disable', 'show'],
  profile: ['list', 'create', 'use', 'show', 'scope', 'clone', 'export', 'import', 'delete'],
  agents: ['list', 'add', 'use', 'show', 'remove', 'bind', 'route'],
  personality: ['show', 'list', 'edit'],
  mcp: ['server', 'status'],
  gateway: ['status', 'start', 'stop', 'setup', 'channels'],
  channels: ['list', 'setup'],
  whatsapp: ['setup', 'status', 'logout'],
  pairing: ['status', 'code', 'devices', 'revoke'],
  host: ['status', 'install', 'uninstall', 'systemd', 'pid'],
  cron: ['list', 'pause', 'resume', 'remove'],
  logs: ['list', 'tail'],
  skills: ['list'],
  packs: ['list', 'install', 'remove'],
  memory: ['list', 'search', 'facts', 'dreams', 'promote', 'reindex', 'clear', 'backends', 'use', 'status', 'test'],
  sessions: ['list', 'show', 'delete'],
  checkpoint: ['list', 'create', 'restore', 'restore-latest', 'delete'],
  rag: ['search', 'status', 'ingest'],
  backup: ['list', 'create', 'restore', 'verify'],
  ops: ['sandbox', 'dns', 'proxy', 'backup', 'secrets', 'audit', 'turns'],
  providers: ['list', 'test'],
  scout: ['status', 'test', 'pair'],
  security: ['audit', 'status'],
  tenant: ['status'],
  billing: ['status'],
  plugins: ['list', 'enable', 'disable'],
  hooks: ['list'],
  migrate: ['status', 'hermes', 'openclaw'],
  update: ['check', 'run'],
  hub: ['start', 'browse', 'status', 'packs', 'skills', 'search', 'install'],
  contacts: ['list', 'show'],
  secrets: ['list', 'set', 'reload'],
  credentials: ['status', 'pools', 'add', 'remove', 'retire', 'rotate', 'test', 'oauth'],
  curator: ['report', 'list', 'prune', 'archive', 'restore', 'run'],
  kanban: ['status', 'board', 'queue', 'add', 'claim', 'release', 'complete'],
  env: ['show'],
  completion: ['bash', 'zsh', 'fish'],
  ide: ['install', 'build'],
};

export const NESTED_OPTIONS: Record<string, Record<string, readonly string[]>> = {
  agents: {
    bind: ['list', 'add', 'remove'],
    add: [],
    route: [],
  },
  ops: {
    sandbox: ['status', 'list', 'create', 'exec', 'stop', 'prune'],
    dns: ['lookup', 'tailscale', 'resolve'],
    proxy: ['status', 'start', 'stop'],
    backup: ['list', 'create', 'restore', 'verify'],
    secrets: ['reload'],
    audit: [],
  },
  model: {
    set: [...KNOWN_LLM_PROVIDERS],
    test: [...KNOWN_LLM_PROVIDERS],
  },
  providers: {
    test: [...KNOWN_LLM_PROVIDERS],
  },
  channels: {
    setup: [...CHANNEL_NAMES],
  },
  gateway: {
    setup: [...CHANNEL_NAMES],
  },
  tools: {
    list: [...PLATFORM_NAMES],
    toolsets: [...PLATFORM_NAMES],
    enable: [...TOOLSET_NAMES],
    disable: [...TOOLSET_NAMES],
    show: [],
    platform: ['list', 'show', 'set', 'enable', 'disable', 'reset'],
  },
  ide: {
    install: ['vscode', 'cursor', 'zed', 'jetbrains', 'all'],
  },
  migrate: {
    hermes: [],
    openclaw: [],
  },
};

export function subcommandsFor(command: string): readonly string[] {
  return SUBCOMMANDS[command] ?? [];
}

export function nestedOptionsFor(command: string, subcommand: string): readonly string[] {
  return NESTED_OPTIONS[command]?.[subcommand] ?? [];
}
