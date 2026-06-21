import { KNOWN_LLM_PROVIDERS } from '../brain/provider-registry.js';
import { PLATFORM_NAMES, TOOLSET_NAMES } from '../tools/toolset-config.js';

export const TOP_LEVEL_COMMANDS = [
  'chat', 'tui', 'setup', 'serve', 'mcp', 'web', 'config', 'model', 'tools', 'profile',
  'personality', 'agents', 'host', 'gateway', 'channels', 'whatsapp', 'pairing', 'cron', 'doctor',
  'status', 'reset', 'onboard', 'uninstall',
  'logs', 'skills', 'packs', 'extensions', 'install-pack', 'list-packs', 'memory', 'sessions',
  'checkpoint', 'rag', 'backup', 'commitments', 'ops', 'providers', 'scout', 'security', 'tenant',
  'billing', 'plugins', 'hooks', 'migrate', 'update', 'ingest', 'hub', 'contacts',
  'secrets', 'credentials', 'curator', 'kanban', 'env', 'completion', 'ide', 'help', 'version',
  'taskflows', 'tasks', 'acp', 'approvals', 'node-host', 'learning', 'capabilities', 'benchmark',
  'workspace', 'session', 'task', 'skill', 'agent', 'webhook', 'channel', 'cert',
  'ws', 's', 'mem', 'm', 't', 'sk', 'a', 'wh', 'sec', 'ch', 'cfg',
] as const;

export const CHANNEL_NAMES = [
  'telegram', 'whatsapp', 'web', 'discord', 'slack', 'sms', 'signal', 'matrix',
  'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
  'line', 'viber', 'google-chat', 'teams',
  'homeassistant', 'api', 'webhooks', 'cli',
  'ntfy', 'pushover', 'zulip', 'rocketchat', 'twitch', 'reddit', 'bluesky',
  'messenger', 'nextcloud-talk', 'groupme', 'linkedin', 'skype', 'gotify', 'pumble', 'twist', 'ryver', 'workplace',
  'threema', 'kakaotalk', 'naver-works', 'qq', 'weibo', 'openhab', 'synology-chat',
  'keybase', 'gitter', 'element', 'mastodon', 'snapchat', 'bridge-generic', 'apple-business-chat',
] as const;

export { TOOLSET_NAMES };

export const SUBCOMMANDS: Record<string, readonly string[]> = {
  workspace: ['list', 'create', 'switch', 'rename', 'delete', 'current', 'export'],
  session: ['list', 'new', 'resume', 'rename', 'delete', 'export', 'share', 'search', 'stats'],
  task: ['list', 'create', 'status', 'cancel', 'watch', 'export'],
  skill: ['list', 'search', 'install', 'uninstall', 'enable', 'disable', 'info', 'update', 'publish'],
  agent: ['list', 'status', 'cancel', 'logs', 'spawn', 'history'],
  webhook: ['list', 'create', 'delete', 'test', 'logs'],
  channel: ['list', 'add', 'remove', 'test', 'status'],
  cert: ['status', 'generate', 'verify', 'revoke'],
  config: ['list', 'show', 'get', 'set', 'unset', 'edit', 'check', 'migrate', 'reset', 'export', 'import'],
  model: ['menu', 'list', 'set', 'use', 'pick', 'current', 'preset', 'scan', 'test', 'cost', 'benchmark'],
  tools: ['menu', 'list', 'toolsets', 'platform', 'enable', 'disable', 'show'],
  profile: ['list', 'create', 'use', 'current', 'back', 'show', 'scope', 'show-model', 'show-summary', 'clear-model', 'clone', 'export', 'import', 'delete'],
  agents: ['list', 'add', 'use', 'show', 'remove', 'bind', 'route'],
  personality: ['show', 'list', 'edit'],
  mcp: ['list', 'add', 'remove', 'test', 'tools', 'server', 'status'],
  gateway: ['status', 'start', 'stop', 'setup', 'channels'],
  channels: ['list', 'status', 'setup', 'dm', 'threads', 'directory'],
  whatsapp: ['setup', 'status', 'logout'],
  pairing: ['status', 'code', 'devices', 'nodes', 'approve', 'reject', 'revoke', 'rotate', 'qr'],
  'node-host': ['status', 'pair', 'pair-wait', 'configure', 'start', 'stop', 'restart', 'install', 'uninstall', 'audit'],
  host: ['status', 'install', 'uninstall', 'systemd', 'pid'],
  cron: ['list', 'add', 'pause', 'resume', 'remove', 'history', 'workflow'],
  logs: ['list', 'tail'],
  skills: ['list'],
  packs: ['list', 'install', 'remove'],
  extensions: ['list', 'install', 'enable', 'disable', 'remove', 'rollback', 'validate', 'status'],
  memory: ['list', 'add', 'search', 'delete', 'clear', 'export', 'stats', 'sync', 'facts', 'dreams', 'promote', 'reindex', 'backends', 'use', 'status', 'test', 'sessions'],
  sessions: ['list', 'show', 'delete'],
  checkpoint: ['list', 'create', 'restore', 'restore-latest', 'delete'],
  rag: ['search', 'status', 'ingest'],
  backup: ['list', 'create', 'archive', 'plan', 'restore', 'verify'],
  ops: ['sandbox', 'dns', 'proxy', 'backup', 'secrets', 'audit', 'turns', 'control', 'extensibility'],
  providers: ['list', 'info', 'plugins', 'copilot', 'preset', 'health', 'test', 'disable', 'enable', 'scan'],
  scout: ['status', 'events', 'pull', 'investigate', 'report', 'kill', 'reset', 'policy', 'test', 'pair', 'enable'],
  security: ['audit', 'status'],
  tenant: ['status'],
  billing: ['status'],
  plugins: ['list', 'install', 'enable', 'disable', 'remove', 'rollback', 'validate', 'status'],
  hooks: ['list'],
  migrate: ['status', 'claude', 'export', 'import'],
  update: ['check', 'run'],
  hub: ['status', 'featured', 'search', 'stats', 'auth', 'start', 'browse', 'catalog', 'marketplace', 'show', 'install', 'enable', 'disable', 'update', 'remove', 'packs', 'skills', 'publish'],
  contacts: ['list', 'show'],
  secrets: ['list', 'audit', 'review', 'set', 'reload'],
  credentials: ['status', 'pools', 'add', 'remove', 'retire', 'rotate', 'test', 'oauth'],
  curator: ['report', 'list', 'prune', 'archive', 'restore', 'run'],
  learning: ['status', 'recap', 'events', 'pending', 'preferences', 'improvements', 'show', 'versions', 'rollback', 'shared', 'share', 'sync'],
  capabilities: ['audit', 'status', 'tools', 'channels', 'gaps'],
  benchmark: ['run', 'regression', 'list', 'runs', 'report', 'public', 'compare'],
  kanban: ['status', 'board', 'queue', 'add', 'claim', 'release', 'complete'],
  env: ['show'],
  completion: ['bash', 'zsh', 'fish', 'powershell', 'dynamic'],
  reset: ['audit'],
  onboard: ['--install-daemon', '--skip-setup', '--skip-gateway', '--skip-doctor', '--json'],
  uninstall: [],
  status: [],
  ide: ['install', 'build'],
  taskflows: ['status', 'list', 'runs', 'history', 'import', 'delivery', 'create', 'trigger', 'pause', 'resume', 'cancel', 'retry', 'worker'],
  tasks: ['background', 'cron', 'taskflows', 'delivery'],
  acp: ['status', 'sessions', 'create', 'label', 'delete', 'prompt', 'bridge'],
  approvals: ['list', 'allow', 'block', 'grant', 'revoke', 'audit'],
  doctor: ['--json', '--fix', '--repair', '--quiet', '--deep'],
};

export const NESTED_OPTIONS: Record<string, Record<string, readonly string[]>> = {
  agents: {
    bind: ['list', 'add', 'remove'],
    add: [],
    route: [],
  },
  ops: {
    sandbox: ['status', 'list', 'create', 'recreate', 'exec', 'stop', 'teardown', 'prune', 'explain', 'session'],
    control: ['status'],
    extensibility: [],
    dns: ['lookup', 'tailscale', 'resolve'],
    proxy: ['status', 'start', 'stop', 'providers', 'captures'],
    backup: ['list', 'create', 'archive', 'plan', 'restore', 'verify'],
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
    dm: ['list', 'approve', 'reject', 'revoke', 'rotate', 'audit'],
    threads: ['list', 'handoff', 'release', 'audit'],
    directory: ['lookup', 'search', 'register'],
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
};

export function subcommandsFor(command: string): readonly string[] {
  return SUBCOMMANDS[command] ?? [];
}

export function nestedOptionsFor(command: string, subcommand: string): readonly string[] {
  return NESTED_OPTIONS[command]?.[subcommand] ?? [];
}
