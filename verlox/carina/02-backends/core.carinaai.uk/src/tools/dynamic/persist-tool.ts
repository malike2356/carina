import { authorizePersistence, clearSession } from './auth-gate.js';
import { getPendingGeneration, clearPendingGeneration } from './generate-and-run.js';
import { RuntimeToolStore } from './tool-store.js';
import { logSelfModEvent } from '../../security/self-mod-logger.js';

function inferRiskLevel(code: string): 'low' | 'medium' | 'high' {
  if (code.includes('fetch(')) return 'medium';
  return 'low';
}

export const persistRuntimeTool = {
  name: 'persist_runtime_tool',
  description: `Save a successfully-generated tool for permanent future reuse.

REQUIRES SEPARATE AUTHORIZATION: The operator must provide their passphrase AGAIN.
This proves the operator has reviewed the tool output and approves it for persistence.
The passphrase must be entered within 5 minutes of the generation session.`,
  parameters: {
    type: 'object',
    properties: {
      tool_name: {
        type: 'string',
        description: 'The exact tool name returned by generate_and_run_tool.',
      },
      authorization_phrase: {
        type: 'string',
        description: 'The operator authorization passphrase. REQUIRED. Must be entered separately from generation.',
      },
      fetch_allowed_domains: {
        type: 'string',
        description: 'Comma-separated domains this tool may access via fetch(). Example: "api.tavily.com". Leave empty for no network access.',
      },
    },
    required: ['tool_name', 'authorization_phrase'],
  },
  requiresConfirmation: true as const,
  dangerous: true as const,

  async execute(rawParams: Record<string, unknown>): Promise<unknown> {
    const args = rawParams as {
      tool_name: string;
      authorization_phrase: string;
      fetch_allowed_domains?: string;
    };

    // GATE 2: Authorize persistence
    const persistAuth = await authorizePersistence(args.authorization_phrase, args.tool_name);
    args.authorization_phrase = '[REDACTED]';

    if (!persistAuth.authorized) {
      if (persistAuth.lockedOut) {
        return { error: `LOCKED OUT: Tool generation and persistence blocked until ${persistAuth.lockedUntil}.` };
      }
      return { error: persistAuth.error ?? 'Authorization failed. Tool NOT saved.' };
    }

    const pending = getPendingGeneration(args.tool_name);
    if (!pending) {
      return {
        error: `No generated tool named "${args.tool_name}" found in session. Either the 5-minute window expired or the name is incorrect. Generate the tool again.`,
      };
    }

    const domains = args.fetch_allowed_domains
      ? args.fetch_allowed_domains.split(',').map((d) => d.trim()).filter(Boolean)
      : [];

    const store = new RuntimeToolStore();

    // Dedup: do not save identical code twice
    const existing = await store.findByCodeHash(pending.codeHash);
    if (existing) {
      clearPendingGeneration(args.tool_name);
      clearSession();
      return {
        success: true,
        message: `An identical tool already exists as "${existing.name}" (status: ${existing.status}). No duplicate saved.`,
        detail: { existing_name: existing.name, status: existing.status },
      };
    }

    await store.save({
      name: pending.name,
      displayName: pending.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: pending.description,
      category: 'custom',
      parametersJson: JSON.stringify(pending.parameters),
      sourceCode: pending.code,
      sourceCodeHash: pending.codeHash,
      generationPrompt: undefined,
      generatedBy: 'carina',
      generatedAt: new Date().toISOString(),
      modelUsed: undefined,
      staticScanPassed: true,
      sandboxTestPassed: true,
      sandboxTestOutput: pending.sandboxOutput,
      avgDurationMs: pending.durationMs,
      timesUsed: 1,
      status: 'pending',
      riskLevel: inferRiskLevel(pending.code),
      sandboxMemoryMb: 128,
      sandboxTimeoutMs: 30000,
      fetchAllowedDomains: domains.length > 0 ? domains.join(',') : undefined,
    });

    clearPendingGeneration(args.tool_name);
    clearSession();

    void logSelfModEvent('TOOL_PERSIST_SAVED', {
      tool_name: args.tool_name,
      fetch_domains: domains.length > 0 ? domains.join(',') : '(none)',
      code_hash: pending.codeHash,
      risk_level: inferRiskLevel(pending.code),
    });

    return {
      success: true,
      message: `Tool "${args.tool_name}" saved as pending. To activate it permanently, say: "Carina, approve tool ${args.tool_name}".`,
      detail: {
        tool_name: args.tool_name,
        status: 'pending',
        fetch_allowed_domains: domains,
        code_hash: pending.codeHash,
        next_step: `Call approve_runtime_tool with name "${args.tool_name}" and your authorization phrase to activate.`,
      },
    };
  },
};
