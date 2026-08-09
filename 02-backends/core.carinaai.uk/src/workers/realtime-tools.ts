import { randomUUID } from 'node:crypto';
import type { Tool } from '../types/index.js';
import { getWorker } from '../workers/worker-store.js';
import {
  clearWorkerSessionContext,
  setWorkerSessionContext,
} from '../workers/worker-session-context.js';
import {
  describeProductToolGrantsForPrompt,
  listEffectiveToolGrants,
  listVaultSecrets,
} from '../workers/aiva-parity-store.js';
import { registerProductToolAdapters } from '../tools/product-tool-adapters.js';
import { getSessionTool } from '../tools/session-tool-store.js';

export type RealtimeToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const VOICE_BLOCKED_TOOLS = new Set<string>([
  // Prefer approval draft over live send on voice unless the model is sure.
]);

function vaultTools(): Tool[] {
  return [
    {
      name: 'vault-list-labels',
      description:
        'List vault secret labels for this worker (names only, never values). '
        + 'Use when the caller asks what secrets or API keys are stored.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        // Filled in executeRealtimeToolCall via session context.
        return { ok: false, error: 'vault tool not bound' };
      },
    },
  ];
}

/**
 * OpenAI Realtime-compatible tool schemas for connected Aiva product tools + vault labels.
 */
export async function listRealtimeToolDefinitions(
  workspaceId: string,
  workerId: string,
): Promise<{ tools: RealtimeToolDefinition[]; instructionsSuffix: string; toolNames: string[] }> {
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    throw new Error('Worker not found');
  }

  const sessionId = `realtime-tools:${workerId}:${randomUUID()}`;
  setWorkerSessionContext(sessionId, {
    worker,
    personaPrompt: worker.personaPrompt,
    channel: 'web',
    contactId: 'realtime-owner',
  });

  try {
    const { registerAivaWorkspaceSessionTools } = await import('../tools/aiva-workspace-tools.js');
    const { registerWorkerAutomationSessionTools } = await import('../tools/worker-automation.js');
    registerWorkerAutomationSessionTools(sessionId);
    const workspaceNames = registerAivaWorkspaceSessionTools(sessionId);
    const registered = await registerProductToolAdapters(sessionId);
    const tools: RealtimeToolDefinition[] = [];

    for (const name of [...workspaceNames, ...registered, 'worker-automation']) {
      if (VOICE_BLOCKED_TOOLS.has(name)) continue;
      const tool = getSessionTool(sessionId, name);
      if (!tool) continue;
      if (tools.some((t) => t.name === tool.name)) continue;
      tools.push({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: (tool.parameters ?? { type: 'object', properties: {} }) as Record<string, unknown>,
      });
    }

    const grants = await listEffectiveToolGrants(workspaceId, workerId);
    const hasVault = true;
    if (hasVault) {
      tools.push({
        type: 'function',
        name: 'vault-list-labels',
        description: vaultTools()[0].description,
        parameters: { type: 'object', properties: {} },
      });
    }

    const grantPrompt = await describeProductToolGrantsForPrompt(workspaceId, workerId);
    const connectedCount = grants.filter((g) => g.status === 'connected').length;
    const instructionsSuffix = [
      grantPrompt,
      '',
      'Voice tool use:',
      '- You can call the listed tools during this live call.',
      '- For destructive or send actions (gmail-send), confirm the recipient and content with the caller first.',
      '- Prefer short spoken summaries of tool results; do not read raw JSON.',
      connectedCount === 0
        ? '- No SaaS tools are connected yet. Say so if asked to use Gmail, Calendar, Drive, or Trello.'
        : `- Connected tool count: ${connectedCount}.`,
      '- vault-list-labels shows secret names only, never secret values.',
    ].join('\n');

    return {
      tools,
      instructionsSuffix,
      toolNames: tools.map((t) => t.name),
    };
  } finally {
    clearWorkerSessionContext(sessionId);
  }
}

export async function executeRealtimeToolCall(input: {
  workspaceId: string;
  workerId: string;
  name: string;
  args?: Record<string, unknown>;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const toolName = String(input.name ?? '').trim();
  if (!toolName) return { ok: false, error: 'tool name required' };

  if (toolName === 'vault-list-labels') {
    try {
      const secrets = await listVaultSecrets(input.workspaceId, input.workerId);
      return {
        ok: true,
        data: {
          labels: secrets.map((s) => ({
            id: s.id,
            label: s.label,
            kind: s.kind,
          })),
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker) return { ok: false, error: 'Worker not found' };

  const sessionId = `realtime-exec:${input.workerId}:${randomUUID()}`;
  setWorkerSessionContext(sessionId, {
    worker,
    personaPrompt: worker.personaPrompt,
    channel: 'web',
    contactId: 'realtime-owner',
  });

  try {
    await registerProductToolAdapters(sessionId);
    const tool = getSessionTool(sessionId, toolName);
    if (!tool) {
      return {
        ok: false,
        error: `Tool ${toolName} is not available. Connect it under Tools, or use a listed tool name.`,
      };
    }
    const result = await tool.execute(input.args ?? {});
    if (result && typeof result === 'object' && 'ok' in (result as object)) {
      const typed = result as { ok: boolean; data?: unknown; error?: string };
      return typed.ok
        ? { ok: true, data: typed.data ?? typed }
        : { ok: false, error: typed.error ?? 'Tool failed' };
    }
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearWorkerSessionContext(sessionId);
  }
}
