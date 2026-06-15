export const LEAF_EXCLUDED_TOOLS = [
  'delegate-task',
  'kanban',
  'clarify',
  'memory',
  'session-search',
  'todo',
  'email-send',
  'code-exec',
  'cronjob',
  'webhook',
  'checkpoint-manager',
  'debug-helpers',
  'mixture-of-agents',
  'computer-use',
] as const;

/**
 * Tools always given to the main agent regardless of toolset config.
 * These are excluded from subagents via LEAF_EXCLUDED_TOOLS + filterLeafTools.
 */
export const ALWAYS_ON_TOOLS = ['memory', 'todo', 'clarify', 'session-search'] as const;

export const TOOLSET_MAP: Record<string, string[]> = {
  terminal: ['shell-exec', 'process'],
  file: ['file-read', 'file-write', 'patch', 'search-files'],
  web: ['http-request', 'web-search'],
  browser: [
    'browser-navigate',
    'browser-click',
    'browser-type',
    'browser-press',
    'browser-scroll',
    'browser-snapshot',
    'browser-console',
    'browser-back',
    'browser-get-images',
    'browser-vision',
    'browser-cdp',
    'browser-dialog',
  ],
  search: ['web-search', 'session-search'],
  skills: ['skills-list', 'skill-view', 'skill-manage', 'skill-curator'],
  sync: ['agent-sync', 'contacts'],
  messaging: ['send-message', 'webhook', 'email-send', 'email-smtp-send', 'email-list', 'generate-pdf'],
  media: [
    'vision-analyze',
    'video-analyze',
    'transcription',
    'text-to-speech',
    'image-generation',
    'video-generation',
    'spotify-search',
    'spotify-now-playing',
    'spotify-play',
  ],
  mcp: ['mcp'],
  orchestration: [
    'delegate-task',
    'kanban',
    'kanban-show',
    'kanban-list',
    'kanban-create',
    'kanban-complete',
    'kanban-block',
    'kanban-unblock',
    'kanban-link',
    'kanban-comment',
    'kanban-heartbeat',
    'cronjob',
  ],
  debug: ['debug-helpers', 'lsp'],
  checkpoint: ['checkpoint-manager'],
  integrations: [
    'homeassistant',
    'ha-list-entities',
    'ha-get-state',
    'ha-list-services',
    'ha-call-service',
    'x-search',
    'x-post',
    'discord',
    'discord-admin',
    'feishu-doc',
    'feishu-drive',
    'feishu-chat-send',
    'feishu-user-lookup',
    'yuanbao',
    'yb-chat',
    'yb-search',
    'platform-integrate',
  ],
  ensemble: ['mixture-of-agents'],
  workspace: ['notes-manage', 'documents-manage', 'images-gallery'],
  ops: ['secrets-audit', 'debug-helpers', 'capabilities-audit', 'channel-status-snapshot', 'learning-status'],
  utilities: [
    'json-format',
    'text-hash',
    'uuid-generate',
    'timestamp-convert',
    'base64-codec',
    'url-parse',
    'markdown-to-text',
    'text-diff',
    'random-string',
    'unit-convert',
    'semver-compare',
    'regex-test',
    'slugify-text',
    'csv-parse',
    'ip-parse',
    'env-presence',
    'cron-explain',
    'rss-fetch',
    'research-list',
    'yaml-json-convert',
    'color-convert',
    'git-brief-status',
    'disk-usage',
    'hex-encode',
  ],
};

export const TOOLSET_NAMES = [
  'terminal',
  'file',
  'web',
  'browser',
  'search',
  'skills',
  'sync',
  'messaging',
  'media',
  'mcp',
  'orchestration',
  'debug',
  'checkpoint',
  'integrations',
  'ensemble',
  'workspace',
  'ops',
  'utilities',
] as const;

export function resolveToolset(toolsets: string[]): string[] {
  const names = new Set<string>();
  for (const set of toolsets) {
    const key = set.toLowerCase().trim();
    const mapped = TOOLSET_MAP[key];
    if (mapped) {
      for (const tool of mapped) names.add(tool);
    } else {
      names.add(key);
    }
  }
  for (const excluded of LEAF_EXCLUDED_TOOLS) {
    names.delete(excluded);
  }
  return [...names];
}

export function filterLeafTools(tools: string[]): string[] {
  const excluded = new Set<string>(LEAF_EXCLUDED_TOOLS);
  return tools.filter((t) => !excluded.has(t));
}
