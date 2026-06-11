export type ToolRiskClass = 'read' | 'write' | 'execute' | 'external' | 'credential';

export interface ToolRiskSpec {
  riskClass: ToolRiskClass;
  sideEffects: readonly string[];
  /** Tool must set dangerous:true on the Tool object (enforced by CI). */
  requiresDangerousFlag: boolean;
}

/**
 * Authoritative risk classification for every Carina tool.
 * CI fails if a registered tool is missing from this map.
 */
export const TOOL_RISK_REGISTRY: Record<string, ToolRiskSpec> = {
  // Read
  'file-read': { riskClass: 'read', sideEffects: ['reads local files'], requiresDangerousFlag: false },
  'search-files': { riskClass: 'read', sideEffects: ['searches local files'], requiresDangerousFlag: false },
  'email-list': { riskClass: 'read', sideEffects: ['reads stored inbound mail'], requiresDangerousFlag: false },
  'skills-list': { riskClass: 'read', sideEffects: [], requiresDangerousFlag: false },
  'skill-view': { riskClass: 'read', sideEffects: [], requiresDangerousFlag: false },
  'session-search': { riskClass: 'read', sideEffects: ['searches session history'], requiresDangerousFlag: false },
  'memory': { riskClass: 'read', sideEffects: ['reads/writes agent memory store'], requiresDangerousFlag: false },
  'contacts': { riskClass: 'read', sideEffects: [], requiresDangerousFlag: false },
  'ha-list-entities': { riskClass: 'read', sideEffects: ['reads Home Assistant state'], requiresDangerousFlag: false },
  'ha-get-state': { riskClass: 'read', sideEffects: ['reads Home Assistant state'], requiresDangerousFlag: false },
  'ha-list-services': { riskClass: 'read', sideEffects: ['reads Home Assistant services'], requiresDangerousFlag: false },
  'feishu-user-lookup': { riskClass: 'read', sideEffects: ['external API read'], requiresDangerousFlag: false },
  'spotify-search': { riskClass: 'read', sideEffects: ['external API read'], requiresDangerousFlag: false },
  'spotify-now-playing': { riskClass: 'read', sideEffects: ['external API read'], requiresDangerousFlag: false },
  'kanban-show': { riskClass: 'read', sideEffects: [], requiresDangerousFlag: false },
  'kanban-list': { riskClass: 'read', sideEffects: [], requiresDangerousFlag: false },
  'todo': { riskClass: 'read', sideEffects: ['mutates session todo list'], requiresDangerousFlag: false },
  'clarify': { riskClass: 'read', sideEffects: [], requiresDangerousFlag: false },
  'debug-helpers': { riskClass: 'read', sideEffects: ['exposes debug metadata'], requiresDangerousFlag: false },

  // Write
  'file-write': { riskClass: 'write', sideEffects: ['writes local files'], requiresDangerousFlag: true },
  'patch': { riskClass: 'write', sideEffects: ['mutates local files'], requiresDangerousFlag: true },
  'send-message': { riskClass: 'write', sideEffects: ['sends outbound messages'], requiresDangerousFlag: true },
  'email-send': { riskClass: 'write', sideEffects: ['sends outbound email'], requiresDangerousFlag: true },
  'webhook': { riskClass: 'write', sideEffects: ['registers outbound webhooks'], requiresDangerousFlag: true },
  'skill-manage': { riskClass: 'write', sideEffects: ['mutates skill packs'], requiresDangerousFlag: true },
  'skill-curator': { riskClass: 'write', sideEffects: ['mutates skills'], requiresDangerousFlag: true },
  'checkpoint-manager': { riskClass: 'write', sideEffects: ['creates/restores checkpoints'], requiresDangerousFlag: true },
  'kanban-create': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban-complete': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban-block': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban-unblock': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban-link': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban-comment': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban-heartbeat': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'kanban': { riskClass: 'write', sideEffects: ['mutates kanban state'], requiresDangerousFlag: true },
  'image-generation': { riskClass: 'write', sideEffects: ['external generative API'], requiresDangerousFlag: true },
  'video-generation': { riskClass: 'write', sideEffects: ['external generative API'], requiresDangerousFlag: true },
  'spotify-play': { riskClass: 'write', sideEffects: ['controls Spotify playback'], requiresDangerousFlag: true },
  'x-post': { riskClass: 'write', sideEffects: ['posts to X/Twitter'], requiresDangerousFlag: true },
  'discord-admin': { riskClass: 'write', sideEffects: ['Discord admin actions'], requiresDangerousFlag: true },
  'ha-call-service': { riskClass: 'write', sideEffects: ['triggers Home Assistant services'], requiresDangerousFlag: true },
  'cronjob': { riskClass: 'write', sideEffects: ['schedules recurring agent jobs'], requiresDangerousFlag: true },

  // Execute
  'shell-exec': { riskClass: 'execute', sideEffects: ['runs shell commands'], requiresDangerousFlag: true },
  'process': { riskClass: 'execute', sideEffects: ['spawns host processes'], requiresDangerousFlag: true },
  'code-exec': { riskClass: 'execute', sideEffects: ['runs sandboxed code'], requiresDangerousFlag: true },
  'computer-use': { riskClass: 'execute', sideEffects: ['desktop automation'], requiresDangerousFlag: true },
  'lsp': { riskClass: 'execute', sideEffects: ['runs language server queries'], requiresDangerousFlag: true },

  // External side effects
  'http-request': { riskClass: 'external', sideEffects: ['outbound HTTPS'], requiresDangerousFlag: true },
  'web-search': { riskClass: 'external', sideEffects: ['outbound search API'], requiresDangerousFlag: false },
  'vision-analyze': { riskClass: 'external', sideEffects: ['vision API'], requiresDangerousFlag: false },
  'video-analyze': { riskClass: 'external', sideEffects: ['video analysis API'], requiresDangerousFlag: false },
  'transcription': { riskClass: 'external', sideEffects: ['speech API'], requiresDangerousFlag: false },
  'text-to-speech': { riskClass: 'external', sideEffects: ['TTS API'], requiresDangerousFlag: false },
  'homeassistant': { riskClass: 'external', sideEffects: ['Home Assistant API'], requiresDangerousFlag: false },
  'x-search': { riskClass: 'external', sideEffects: ['X/Twitter API'], requiresDangerousFlag: false },
  'discord': { riskClass: 'external', sideEffects: ['Discord API'], requiresDangerousFlag: false },
  'feishu-doc': { riskClass: 'external', sideEffects: ['Feishu API'], requiresDangerousFlag: false },
  'feishu-drive': { riskClass: 'external', sideEffects: ['Feishu API'], requiresDangerousFlag: false },
  'feishu-chat-send': { riskClass: 'external', sideEffects: ['sends Feishu messages'], requiresDangerousFlag: true },
  'yuanbao': { riskClass: 'external', sideEffects: ['Yuanbao API'], requiresDangerousFlag: false },
  'yb-chat': { riskClass: 'external', sideEffects: ['Yuanbao chat API'], requiresDangerousFlag: false },
  'yb-search': { riskClass: 'external', sideEffects: ['Yuanbao search API'], requiresDangerousFlag: false },
  'agent-sync': { riskClass: 'external', sideEffects: ['syncs with remote agents'], requiresDangerousFlag: false },
  'delegate-task': { riskClass: 'external', sideEffects: ['spawns sub-agent work'], requiresDangerousFlag: true },
  'mixture-of-agents': { riskClass: 'external', sideEffects: ['multi-agent orchestration'], requiresDangerousFlag: true },
  'browser-navigate': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: true },
  'browser-click': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: true },
  'browser-type': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: true },
  'browser-press': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: true },
  'browser-scroll': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: true },
  'browser-snapshot': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: false },
  'browser-console': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: false },
  'browser-back': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: false },
  'browser-get-images': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: false },
  'browser-vision': { riskClass: 'external', sideEffects: ['browser + vision API'], requiresDangerousFlag: true },
  'browser-cdp': { riskClass: 'external', sideEffects: ['browser CDP control'], requiresDangerousFlag: true },
  'browser-dialog': { riskClass: 'external', sideEffects: ['browser automation'], requiresDangerousFlag: true },

  // Credential access
  'mcp': { riskClass: 'credential', sideEffects: ['connects to external MCP servers'], requiresDangerousFlag: true },
};

export const LEAK_PRONE_TOOL_NAMES = [
  'file-write',
  'patch',
  'email-send',
  'send-message',
  'webhook',
  'http-request',
  'code-exec',
  'shell-exec',
  'process',
  'mcp',
  'computer-use',
  'delegate-task',
  'cronjob',
  'checkpoint-manager',
  'x-post',
  'ha-call-service',
  'discord-admin',
  'feishu-chat-send',
] as const;

export function lookupToolRisk(name: string): ToolRiskSpec | undefined {
  return TOOL_RISK_REGISTRY[name];
}
