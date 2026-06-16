import { registry } from './registry.js';
import { TOOLSET_MAP } from './toolset.js';
import { lookupToolRisk } from './tool-risk-registry.js';
import { getCompactToolDescription } from './tool-descriptions.js';

export type ToolSurface =
  | 'agent'
  | 'cli'
  | 'web'
  | 'mcp'
  | 'cron'
  | 'subagent'
  | 'playwright'
  | 'ops'
  | 'pack'
  | 'platform';

export type ToolCatalogEntry = {
  name: string;
  category: string;
  purpose: string;
  surfaces: ToolSurface[];
  toolset?: string;
  optional?: boolean;
  registered: boolean;
  riskClass?: string;
};

const TOOL_META: Record<string, Omit<ToolCatalogEntry, 'name' | 'registered' | 'riskClass'>> = {
  'web-search': {
    category: 'web',
    purpose: 'Search the public web for current information',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'web',
  },
  'http-request': {
    category: 'web',
    purpose: 'Send outbound HTTP requests to APIs and webhooks',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'web',
  },
  'file-read': {
    category: 'file',
    purpose: 'Read local text files with line numbers and pagination',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  'file-write': {
    category: 'file',
    purpose: 'Create or overwrite local files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  patch: {
    category: 'file',
    purpose: 'Apply fuzzy find-and-replace edits to files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  'search-files': {
    category: 'file',
    purpose: 'Ripgrep-backed content and filename search',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  'shell-exec': {
    category: 'terminal',
    purpose: 'Execute shell commands (foreground, background, optional PTY)',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'terminal',
  },
  process: {
    category: 'terminal',
    purpose: 'Manage background shell processes (poll, log, kill, stdin)',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'terminal',
  },
  'code-exec': {
    category: 'terminal',
    purpose: 'Run sandboxed scripts with bridged tool access',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'terminal',
  },
  memory: {
    category: 'memory',
    purpose: 'Persist durable facts across sessions (user profile and agent notes)',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron'],
    toolset: 'search',
  },
  'session-search': {
    category: 'memory',
    purpose: 'Full-text search across past conversation transcripts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron'],
    toolset: 'search',
  },
  todo: {
    category: 'workspace',
    purpose: 'In-session multi-step task tracking synced to notes surface',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'orchestration',
  },
  clarify: {
    category: 'interaction',
    purpose: 'Ask the user structured or open-ended questions mid-turn',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'notes-manage': {
    category: 'workspace',
    purpose: 'CRUD workspace notes, tasks, and reminders (/notes)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'workspace',
  },
  'documents-manage': {
    category: 'workspace',
    purpose: 'CRUD workspace documents (/documents)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'workspace',
  },
  'images-gallery': {
    category: 'workspace',
    purpose: 'List, inspect, and delete persisted gallery images (/images)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'workspace',
  },
  'delegate-task': {
    category: 'orchestration',
    purpose: 'Spawn parallel subagents with isolated toolsets',
    surfaces: ['agent', 'cli', 'web', 'subagent'],
    toolset: 'orchestration',
  },
  cronjob: {
    category: 'orchestration',
    purpose: 'Schedule recurring or one-shot autonomous jobs',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  kanban: {
    category: 'orchestration',
    purpose: 'Multi-agent kanban board (legacy combined tool)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-show': {
    category: 'orchestration',
    purpose: 'Show kanban board summary',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-list': {
    category: 'orchestration',
    purpose: 'List kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-create': {
    category: 'orchestration',
    purpose: 'Create kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-complete': {
    category: 'orchestration',
    purpose: 'Mark kanban cards complete',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-block': {
    category: 'orchestration',
    purpose: 'Block kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-unblock': {
    category: 'orchestration',
    purpose: 'Unblock kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-link': {
    category: 'orchestration',
    purpose: 'Link kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-comment': {
    category: 'orchestration',
    purpose: 'Comment on kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-heartbeat': {
    category: 'orchestration',
    purpose: 'Kanban heartbeat and stale-card checks',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'send-message': {
    category: 'messaging',
    purpose: 'Send outbound messages on enabled channel adapters',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'messaging',
  },
  webhook: {
    category: 'messaging',
    purpose: 'Subscribe to and emit outbound webhook events',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'email-send': {
    category: 'messaging',
    purpose: 'Send outbound email via configured provider',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'email-smtp-send': {
    category: 'messaging',
    purpose: 'Send email via direct SMTP relay',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'email-list': {
    category: 'messaging',
    purpose: 'List recent inbound email activity',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'generate-pdf': {
    category: 'messaging',
    purpose: 'Render HTML or markdown content to a PDF file',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'skills-list': {
    category: 'skills',
    purpose: 'List installed skills and packs',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'skills',
  },
  'skill-view': {
    category: 'skills',
    purpose: 'Load skill content and linked files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'skills',
  },
  'skill-manage': {
    category: 'skills',
    purpose: 'Create, update, or delete skills',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'skills',
  },
  'skill-curator': {
    category: 'skills',
    purpose: 'Curate, merge, and deprecate skills',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'skills',
  },
  'agent-sync': {
    category: 'sync',
    purpose: 'Sync state with remote Carina agents',
    surfaces: ['agent', 'cli', 'web', 'mcp'],
    toolset: 'sync',
  },
  contacts: {
    category: 'sync',
    purpose: 'Search personal and business contacts from profiles',
    surfaces: ['agent', 'cli', 'web', 'mcp'],
    toolset: 'sync',
  },
  mcp: {
    category: 'mcp',
    purpose: 'Connect to external MCP servers (stdio and HTTP)',
    surfaces: ['agent', 'cli', 'web', 'mcp'],
    toolset: 'mcp',
  },
  'vision-analyze': {
    category: 'media',
    purpose: 'Analyze images with vision models',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'video-analyze': {
    category: 'media',
    purpose: 'Analyze video content',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  transcription: {
    category: 'media',
    purpose: 'Transcribe audio to text (STT)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'text-to-speech': {
    category: 'media',
    purpose: 'Convert text to speech audio',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'image-generation': {
    category: 'media',
    purpose: 'Generate images from prompts and persist to gallery',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'video-generation': {
    category: 'media',
    purpose: 'Generate video storyboards or clips when configured',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'spotify-search': {
    category: 'media',
    purpose: 'Search Spotify catalog',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'media',
  },
  'spotify-now-playing': {
    category: 'media',
    purpose: 'Read current Spotify playback',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'media',
  },
  'spotify-play': {
    category: 'media',
    purpose: 'Control Spotify playback',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'media',
  },
  'debug-helpers': {
    category: 'debug',
    purpose: 'Expose debug metadata for operator troubleshooting',
    surfaces: ['agent', 'cli', 'ops'],
    toolset: 'debug',
  },
  lsp: {
    category: 'debug',
    purpose: 'Query language servers for definitions and diagnostics',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'debug',
  },
  'checkpoint-manager': {
    category: 'checkpoint',
    purpose: 'Create and restore workspace checkpoints',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'checkpoint',
  },
  'mixture-of-agents': {
    category: 'ensemble',
    purpose: 'Run multi-model ensemble reasoning',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'ensemble',
  },
  'computer-use': {
    category: 'browser',
    purpose: 'Desktop automation via Playwright (high risk, opt-in)',
    surfaces: ['agent', 'cli', 'web', 'playwright'],
    toolset: 'browser',
    optional: true,
  },
  'browser-navigate': {
    category: 'browser',
    purpose: 'Navigate headless browser to a URL',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-click': {
    category: 'browser',
    purpose: 'Click element by snapshot ref',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-type': {
    category: 'browser',
    purpose: 'Type into browser input fields',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-press': {
    category: 'browser',
    purpose: 'Press keyboard keys in the browser',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-scroll': {
    category: 'browser',
    purpose: 'Scroll the browser viewport',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-snapshot': {
    category: 'browser',
    purpose: 'Capture accessibility-tree page snapshot',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-console': {
    category: 'browser',
    purpose: 'Read browser console output or evaluate JS',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-back': {
    category: 'browser',
    purpose: 'Navigate back in browser history',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-get-images': {
    category: 'browser',
    purpose: 'List images on the current page',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-vision': {
    category: 'browser',
    purpose: 'Vision-assisted browser interaction',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-cdp': {
    category: 'browser',
    purpose: 'Low-level Chrome DevTools Protocol browser control',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-dialog': {
    category: 'browser',
    purpose: 'Handle browser alert/confirm/prompt dialogs',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  homeassistant: {
    category: 'integrations',
    purpose: 'Home Assistant REST integration (legacy combined tool)',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-list-entities': {
    category: 'integrations',
    purpose: 'List Home Assistant entities',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-get-state': {
    category: 'integrations',
    purpose: 'Read Home Assistant entity state',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-list-services': {
    category: 'integrations',
    purpose: 'List Home Assistant services',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-call-service': {
    category: 'integrations',
    purpose: 'Call Home Assistant services',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'x-search': {
    category: 'integrations',
    purpose: 'Search X/Twitter',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'x-post': {
    category: 'integrations',
    purpose: 'Post to X/Twitter',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  discord: {
    category: 'integrations',
    purpose: 'Send Discord messages',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'discord-admin': {
    category: 'integrations',
    purpose: 'Discord admin actions',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-doc': {
    category: 'integrations',
    purpose: 'Read and write Feishu documents',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-drive': {
    category: 'integrations',
    purpose: 'Browse Feishu drive files',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-chat-send': {
    category: 'integrations',
    purpose: 'Send Feishu chat messages',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-user-lookup': {
    category: 'integrations',
    purpose: 'Look up Feishu users',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  yuanbao: {
    category: 'integrations',
    purpose: 'Yuanbao Hunyuan API (legacy combined tool)',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'yb-chat': {
    category: 'integrations',
    purpose: 'Yuanbao chat completion',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'yb-search': {
    category: 'integrations',
    purpose: 'Yuanbao web search',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'platform-integrate': {
    category: 'platform',
    purpose: 'Optional macOS integrations (1Password, Apple Notes, Bear, camera)',
    surfaces: ['agent', 'cli', 'platform'],
    toolset: 'integrations',
    optional: true,
  },
  'secrets-audit': {
    category: 'ops',
    purpose: 'Read-only local secrets hygiene audit for operators',
    surfaces: ['agent', 'cli', 'ops'],
    toolset: 'ops',
  },
  domain_lookup: {
    category: 'pack',
    purpose: 'Domain-specific lookup when a vertical pack is active',
    surfaces: ['agent', 'pack'],
    optional: true,
  },
  'json-format': { category: 'utilities', purpose: 'Parse and format JSON', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'text-hash': { category: 'utilities', purpose: 'Compute text digests', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'uuid-generate': { category: 'utilities', purpose: 'Generate UUID v4 values', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'timestamp-convert': { category: 'utilities', purpose: 'Convert Unix and ISO timestamps', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'base64-codec': { category: 'utilities', purpose: 'Base64 encode/decode UTF-8 text', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'url-parse': { category: 'utilities', purpose: 'Parse or build URLs', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'markdown-to-text': { category: 'utilities', purpose: 'Strip markdown to plain text', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'text-diff': { category: 'utilities', purpose: 'Line diff between two texts', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'random-string': { category: 'utilities', purpose: 'Generate random tokens', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'unit-convert': { category: 'utilities', purpose: 'Convert bytes, temperature, distance', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'semver-compare': { category: 'utilities', purpose: 'Compare semantic versions', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'regex-test': { category: 'utilities', purpose: 'Test regex patterns', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'slugify-text': { category: 'utilities', purpose: 'Create URL slugs', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'csv-parse': { category: 'utilities', purpose: 'Parse simple CSV', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'ip-parse': { category: 'utilities', purpose: 'Validate IP addresses locally', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'env-presence': { category: 'utilities', purpose: 'Check env key presence without values', surfaces: ['agent', 'cli', 'ops'], toolset: 'utilities' },
  'cron-explain': { category: 'utilities', purpose: 'Explain cron schedules', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'rss-fetch': { category: 'utilities', purpose: 'Fetch RSS/Atom feeds', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'research-list': { category: 'utilities', purpose: 'List saved deep-research reports', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'learning-status': { category: 'ops', purpose: 'Self-improvement loop metrics', surfaces: ['agent', 'cli', 'ops'], toolset: 'ops' },
  'capabilities-audit': { category: 'ops', purpose: 'Audit tools/skills/channels vs targets', surfaces: ['agent', 'cli', 'ops'], toolset: 'ops' },
  'channel-status-snapshot': { category: 'ops', purpose: 'Channel health summary', surfaces: ['agent', 'cli', 'ops'], toolset: 'ops' },
  'yaml-json-convert': { category: 'utilities', purpose: 'Convert YAML and JSON', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'color-convert': { category: 'utilities', purpose: 'Convert hex and RGB colors', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'git-brief-status': { category: 'utilities', purpose: 'Read-only git status', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'disk-usage': { category: 'utilities', purpose: 'Local path size summary', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'hex-encode': { category: 'utilities', purpose: 'Hex encode/decode UTF-8 text', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
};

function resolveToolset(name: string): string | undefined {
  for (const [set, tools] of Object.entries(TOOLSET_MAP)) {
    if (tools.includes(name)) return set;
  }
  return TOOL_META[name]?.toolset;
}

export function buildToolSurfaceCatalog(): ToolCatalogEntry[] {
  const registered = new Map(registry.list().map((t) => [t.name, t]));
  const names = new Set([
    ...Object.keys(TOOL_META),
    ...registered.keys(),
    ...Object.values(TOOLSET_MAP).flat(),
  ]);

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const tool = registered.get(name);
      const meta = TOOL_META[name];
      const risk = lookupToolRisk(name);
      const catalogPurpose = meta?.purpose
        ?? registry.getMeta(name)?.compactDescription
        ?? getCompactToolDescription(name, tool?.description);
      return {
        name,
        category: meta?.category ?? 'unclassified',
        purpose: catalogPurpose,
        surfaces: meta?.surfaces ?? ['agent'],
        toolset: meta?.toolset ?? resolveToolset(name),
        optional: meta?.optional,
        registered: Boolean(tool),
        riskClass: risk?.riskClass,
      };
    });
}

export function summarizeToolCatalog(entries = buildToolSurfaceCatalog()): {
  totalCatalogued: number;
  registered: number;
  optional: number;
  byCategory: Record<string, number>;
  bySurface: Record<ToolSurface, number>;
} {
  const registeredEntries = entries.filter((e) => e.registered);
  const byCategory: Record<string, number> = {};
  const bySurface: Record<ToolSurface, number> = {
    agent: 0,
    cli: 0,
    web: 0,
    mcp: 0,
    cron: 0,
    subagent: 0,
    playwright: 0,
    ops: 0,
    pack: 0,
    platform: 0,
  };

  for (const entry of registeredEntries) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    for (const surface of entry.surfaces) {
      bySurface[surface]++;
    }
  }

  return {
    totalCatalogued: entries.length,
    registered: registeredEntries.length,
    optional: registeredEntries.filter((e) => e.optional).length,
    byCategory,
    bySurface,
  };
}

export function findCatalogGaps(entries = buildToolSurfaceCatalog()): {
  registeredWithoutMeta: string[];
  metaWithoutRegistration: string[];
} {
  return {
    registeredWithoutMeta: entries
      .filter((e) => e.registered && !TOOL_META[e.name])
      .map((e) => e.name),
    metaWithoutRegistration: entries
      .filter((e) => TOOL_META[e.name] && !e.registered && !TOOL_META[e.name]?.optional)
      .map((e) => e.name),
  };
}
