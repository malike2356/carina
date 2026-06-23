import { resolveSurface } from '../product/surface-capabilities.js';
import { listSessionTools } from './session-tool-store.js';
import { inferToolset } from './registry.js';

const TOOLSET_CATEGORY: Record<string, string> = {
  web: 'web',
  search: 'web',
  file: 'files',
  terminal: 'shell',
  workspace: 'files',
  messaging: 'messaging',
  integrations: 'integrations',
  media: 'media',
  skills: 'skills',
  ops: 'ops',
  utilities: 'utilities',
  sync: 'sync',
};

function categorizeTool(toolName: string): string {
  const toolset = inferToolset(toolName);
  if (toolset && TOOLSET_CATEGORY[toolset]) return TOOLSET_CATEGORY[toolset]!;
  if (/shell|exec|process|terminal/.test(toolName)) return 'shell';
  if (/file|read|write|patch|search-files/.test(toolName)) return 'files';
  if (/web-search|http/.test(toolName)) return 'web';
  if (/memory/.test(toolName)) return 'memory';
  return 'tools';
}

export interface ToolStatus {
  available: boolean;
  count: number;
  categories: string[];
  reason?: string;
}

export function getToolStatus(opts?: { platform?: string; sessionId?: string }): ToolStatus {
  const platform = opts?.platform ?? 'cli';
  const surface = resolveSurface({
    platform,
    hostedMode: process.env.HOSTED_MODE === 'true',
    coreProxy: process.env.CARINA_USE_CORE_PROXY === 'true',
  });

  if (surface === 'cloud-byok') {
    return {
      available: false,
      count: 0,
      categories: [],
      reason: 'BYOK chat has no live tool loop on this path.',
    };
  }

  const sessionTools = opts?.sessionId ? listSessionTools(opts.sessionId) : [];
  const categories = [...new Set(sessionTools.map((tool) => categorizeTool(tool.name)))].sort();

  if (sessionTools.length === 0 && (platform === 'telegram' || platform === 'whatsapp')) {
    return {
      available: false,
      count: 0,
      categories: [],
      reason: 'No session tools are registered for this channel yet.',
    };
  }

  return {
    available: sessionTools.length > 0,
    count: sessionTools.length,
    categories,
  };
}
