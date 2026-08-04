import { authorizeApproval, clearSession } from './auth-gate.js';
import { RuntimeToolStore } from './tool-store.js';
import { registerRuntimeTool } from './tool-definition.js';

export const approveRuntimeTool = {
  name: 'approve_runtime_tool',
  description: `Activate a pending runtime-generated tool for permanent persistent use.

REQUIRES AUTHORIZATION: The operator must provide their passphrase AND the exact tool name.
This is a deliberate two-factor check: you must know the secret AND know which tool you are approving.`,
  parameters: {
    type: 'object',
    properties: {
      tool_name: {
        type: 'string',
        description: 'The exact name of the pending tool to approve.',
      },
      authorization_phrase: {
        type: 'string',
        description: 'The operator authorization passphrase. REQUIRED.',
      },
    },
    required: ['tool_name', 'authorization_phrase'],
  },
  requiresConfirmation: true as const,
  dangerous: true as const,

  async execute(rawParams: Record<string, unknown>): Promise<unknown> {
    const args = rawParams as { tool_name: string; authorization_phrase: string };
    // Operator-gating is enforced via LEAF_EXCLUDED_TOOLS + toolset config upstream.

    // GATE 3: Authorize approval
    const approvalAuth = await authorizeApproval(args.authorization_phrase, args.tool_name);
    args.authorization_phrase = '[REDACTED]';

    if (!approvalAuth.authorized) {
      if (approvalAuth.lockedOut) {
        return { error: `LOCKED OUT until ${approvalAuth.lockedUntil}.` };
      }
      return { error: approvalAuth.error ?? 'Authorization failed. Tool NOT approved.' };
    }

    const store = new RuntimeToolStore();
    const pending = await store.list({ status: 'pending' });
    const tool = pending.find((t) => t.name === args.tool_name);

    if (!tool) {
      const names = pending.map((t) => t.name).join(', ');
      return {
        error: `No pending tool named "${args.tool_name}". Pending tools: ${names || '(none)'}`,
      };
    }

    await store.approve(tool.id, 'operator');
    clearSession();

    // Register in the live registry so it is available immediately without restart
    registerRuntimeTool({ ...tool, status: 'active' });

    return {
      success: true,
      message: `Tool "${args.tool_name}" approved and activated. It is now available permanently.`,
      detail: {
        tool_name: tool.name,
        description: tool.description,
        risk_level: tool.riskLevel,
        sandbox_tested: tool.sandboxTestPassed,
        code_hash: tool.sourceCodeHash,
      },
    };
  },
};
