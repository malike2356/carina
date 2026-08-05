/**
 * Compact tool descriptions; single source for catalog purpose lines and provider schemas.
 * Long parameter docs stay on each Tool definition; purpose lines live here.
 */
export const COMPACT_TOOL_DESCRIPTIONS: Record<string, string> = {
  'web-search': 'Search the public web for current information',
  'http-request': 'Send outbound HTTP requests to APIs and webhooks',
  'file-read': 'Read local text files with line numbers and pagination',
  'file-write': 'Create or overwrite local files',
  patch: 'Apply fuzzy find-and-replace edits to files',
  'search-files': 'Ripgrep-backed content and filename search',
  'shell-exec': 'Execute shell commands (foreground, background, optional PTY)',
  process: 'Manage background shell processes (poll, log, kill, stdin)',
  'gmail-search': 'Search Gmail messages for this worker',
  'gmail-list': 'List recent Gmail messages for this worker',
  'gmail-get': 'Fetch one Gmail message by id',
  'gmail-send': 'Send an email from this worker\'s connected Gmail account',
  'code-exec': 'Run sandboxed scripts with bridged tool access',
  memory: 'Persist durable facts across sessions',
  'session-search': 'Full-text search across past conversation transcripts',
  todo: 'In-session multi-step task tracking',
  clarify: 'Ask the operator a structured clarification question',
  'delegate-task': 'Spawn focused subagents with a reduced toolset',
};

export function getCompactToolDescription(name: string, fallback?: string): string {
  const compact = COMPACT_TOOL_DESCRIPTIONS[name];
  if (compact) return compact;
  if (fallback) {
    const trimmed = fallback.trim();
    const first = trimmed.split(/[.!?\n]/)[0]?.trim();
    if (first && first.length <= 160) return first;
    return trimmed.slice(0, 120);
  }
  return 'Registered tool';
}

export function withCompactDescription<T extends { name: string; description: string }>(tool: T): T {
  const compact = COMPACT_TOOL_DESCRIPTIONS[tool.name];
  if (!compact || tool.description.startsWith(compact)) return tool;
  return { ...tool, description: compact };
}
