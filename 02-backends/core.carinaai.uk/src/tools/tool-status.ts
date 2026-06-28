import { TOOL_CAPABILITIES } from '../credentials/tool-capabilities.js';
import { resolveCredential } from '../credentials/resolver.js';
import { isEncryptionAvailable } from '../credentials/encryption.js';
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

export const toolStatusTool = {
  name: 'tool_status',
  description: `Report which tools are ready and which are missing credentials.
Shows the full picture: what's configured, what's missing, and where each credential comes from (store vs env).
Use this when asked "what can you do" or "what's missing."`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional: filter by category ("search", "ai-providers", "messaging", etc.)',
      },
    },
    required: [],
  },
  async execute(params: Record<string, unknown>) {
    const { category } = params as { category?: string };
    const entries = category
      ? TOOL_CAPABILITIES.filter((e) => e.category === category)
      : TOOL_CAPABILITIES;

    const results = await Promise.all(
      entries.map(async (entry) => {
        const missing: string[] = [];
        for (const cred of entry.required_credentials) {
          const value = await resolveCredential(cred);
          if (!value) missing.push(cred);
        }

        let status: string;
        if (missing.length === 0) {
          status = 'ready';
        } else if (missing.length === entry.required_credentials.length) {
          status = 'unconfigured';
        } else {
          status = 'partial';
        }

        return { ...entry, status, missing };
      }),
    );

    const ready = results.filter((r) => r.status === 'ready').length;
    const partial = results.filter((r) => r.status === 'partial').length;
    const unconfigured = results.filter((r) => r.status === 'unconfigured').length;

    return {
      summary: {
        total_tools: results.length,
        ready,
        partial,
        unconfigured,
        encryption_available: isEncryptionAvailable(),
        env_fallback: 'active',
      },
      tools: results.map((r) => ({
        tool: r.tool_name,
        category: r.category,
        status: r.status,
        missing_credentials: r.missing,
      })),
    };
  },
};

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
