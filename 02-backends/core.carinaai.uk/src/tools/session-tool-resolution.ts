import type { Tool } from '../types/index.js';
import { registry } from './registry.js';
import { listSessionTools } from './session-tool-store.js';
import { resolveActiveToolNames } from './toolset-config.js';
import { ALWAYS_ON_TOOLS, filterLeafTools, resolveToolset } from './toolset.js';
import { isSubagentSession } from '../agents/delegation-context.js';
import { allWorkspaceToolsets, filterWorkspaceTools } from '../workspace/workspace-capabilities.js';
import {
  selectToolsByEmbedding,
  shouldUseEmbeddingToolSelect,
} from './tool-embedding-select.js';
import { primaryMandatoryTools } from './mandatory-tools.js';
import { getModelMetadata } from '../brain/model-metadata.js';
import { filterToolsForPlanMode } from '../security/plan-mode-allowlist.js';
import { resolvePlanMode } from '../security/plan-mode-state.js';
import { getToolExecutionContext } from '../security/tool-execution-context.js';
import { isToolAllowedForWorker } from '../workers/workspace-message-handler.js';

export type SessionToolResolution = {
  names: string[];
  tools: Tool[];
  isSubagent: boolean;
  toolsets: string[];
  embeddingFiltered?: boolean;
};

export function isAivaWorkspaceSession(sessionId: string): boolean {
  return sessionId.startsWith('aiva-');
}

function resolveAivaWorkspaceToolNames(): string[] {
  return filterWorkspaceTools(resolveToolset(allWorkspaceToolsets()), 'business');
}

export function resolveSessionToolNames(opts: {
  sessionId: string;
  platform?: string;
  explicitAllowed?: string[];
}): string[] {
  const isSubagent = isSubagentSession(opts.sessionId);
  const useWorkspaceCatalog =
    isAivaWorkspaceSession(opts.sessionId) && !isSubagent && !opts.explicitAllowed?.length;
  let names = useWorkspaceCatalog
    ? resolveAivaWorkspaceToolNames()
    : resolveActiveToolNames({
        platform: opts.platform,
        explicitAllowed: opts.explicitAllowed,
      });

  if (isSubagent || opts.explicitAllowed?.length) {
    names = isSubagent ? filterLeafTools(names) : names;
  } else {
    // Host memory/session-search browse the shared Core DB. Aiva must use
    // worker-memory / worker-conversation-search (workspace + worker scoped).
    const alwaysOn = isAivaWorkspaceSession(opts.sessionId)
      ? ALWAYS_ON_TOOLS.filter((name) => name !== 'session-search' && name !== 'memory')
      : ALWAYS_ON_TOOLS;
    const allowed = new Set([...names, ...alwaysOn]);
    names = [...allowed];
  }

  return names;
}

function resolveToolsFromNames(
  names: string[],
  sessionId: string,
  opts?: { restrictSessionToAllowed?: boolean },
): Tool[] {
  const allowed = new Set(names);
  const globalTools = registry.list().filter((t) => allowed.has(t.name));
  // Session tools are intentionally registered for this chat (Aiva product adapters,
  // Propreneur connect/portfolio, etc.). Include them even when they are not members
  // of the global toolset name list, as long as the worker policy allows them.
  // When an explicit allowlist is active (communication/coding subagents), only keep
  // session tools that are on that list so gmail-send is not drowned by embedding filter.
  let sessionTools = listSessionTools(sessionId).filter((t) =>
    isToolAllowedForWorker(t.name, sessionId),
  );
  if (opts?.restrictSessionToAllowed) {
    sessionTools = sessionTools.filter((t) => allowed.has(t.name));
  }
  const byName = new Map(globalTools.map((t) => [t.name, t]));
  for (const tool of sessionTools) byName.set(tool.name, tool);
  return [...byName.values()];
}

export async function resolveSessionTools(opts: {
  sessionId: string;
  platform?: string;
  explicitAllowed?: string[];
  userMessage?: string;
  provider?: string;
  model?: string;
}): Promise<SessionToolResolution> {
  const names = resolveSessionToolNames(opts);
  let tools = resolveToolsFromNames(names, opts.sessionId, {
    restrictSessionToAllowed: Boolean(opts.explicitAllowed?.length),
  });
  let embeddingFiltered = false;

  const provider = opts.provider ?? 'openai';
  const model = opts.model ?? 'gpt-4o';
  const metadata = getModelMetadata(provider, model);

  if (
    opts.userMessage?.trim()
    && shouldUseEmbeddingToolSelect({
      toolCount: tools.length,
      contextWindow: metadata.contextWindow,
      provider,
      model,
    })
  ) {
    const mandatoryTools = primaryMandatoryTools(opts.userMessage);
    // Prefer operational workspace tools when embeddings are unavailable.
    // Product adapters (gmail/drive/...) still enter via mandatory patterns or fill slots.
    const sessionToolNames = isAivaWorkspaceSession(opts.sessionId)
      ? listSessionTools(opts.sessionId)
          .map((t) => t.name)
          .filter((n) =>
            n.startsWith('workspace-')
            || n.startsWith('worker-')
            || n.startsWith('companies-house-')
            || n.startsWith('gmail-')
            || n.startsWith('google-')
            || n.startsWith('trello-')
            || n === 'aiva-channel-connect'
            || n === 'contacts'
            || n === 'notes-manage'
            || n === 'documents-manage'
          )
      : [];
    const aivaCoreTools = isAivaWorkspaceSession(opts.sessionId)
      ? [
        'worker-memory',
        'worker-conversation-search',
        'worker-activity-audit',
        'worker-skills',
        'workspace-inventory',
      ]
      : [];
    const alwaysInclude = [...new Set([
      ...ALWAYS_ON_TOOLS,
      ...mandatoryTools,
      ...sessionToolNames,
      ...aivaCoreTools,
    ])];
    tools = await selectToolsByEmbedding({
      tools,
      query: opts.userMessage,
      alwaysInclude,
    });
    embeddingFiltered = true;
  }

  const executionContext = getToolExecutionContext();
  const planMode = resolvePlanMode({
    sessionId: opts.sessionId,
    orgRole: executionContext.orgRole,
    contextPlanMode: executionContext.planMode,
  });
  if (planMode) {
    const filtered = filterToolsForPlanMode(tools);
    tools = filtered.allowed;
  }

  const byName = new Map(tools.map((t) => [t.name, t]));
  const toolsets = registry.toolsetsForNames([...byName.keys()]);

  return {
    names: [...byName.keys()].sort(),
    tools: [...byName.values()],
    isSubagent: isSubagentSession(opts.sessionId),
    toolsets,
    embeddingFiltered,
  };
}
