import type { Tool } from '../types/index.js';
import { dispatchNodeShellCommand, nodeHostRoutesEnabled } from '../infrastructure/node-host/routes.js';
import { enqueueNodeCommand, waitForNodeCommand } from '../infrastructure/node-host/store.js';
import { pushNodeCommand } from '../infrastructure/node-host/node-ws-hub.js';

const PHONE_ACTIONS = ['shell', 'ping'] as const;

export const phoneControlTool: Tool = {
  name: 'phone-control',
  description:
    'Dispatch shell commands to a paired phone node (CARINA_PHONE_NODE_ID). Requires node host enabled on the gateway and a node paired with phone scope.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: [...PHONE_ACTIONS], description: 'Action to run on the phone node' },
      command: { type: 'string', description: 'Shell command when action=shell' },
      timeout_seconds: { type: 'number', description: 'Wait timeout (default 30)' },
    },
    required: ['action'],
  },
  dangerous: true,
  requiresConfirmation: true,
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) {
      return {
        error: 'Node host is not enabled. Set CARINA_NODE_HOST_ENABLED=true on the gateway.',
        code: 'PHONE_NODE_DISABLED',
      };
    }
    const nodeId = String(process.env.CARINA_PHONE_NODE_ID ?? '').trim();
    if (!nodeId) {
      return {
        error: 'Phone node not configured. Set CARINA_PHONE_NODE_ID to a paired node id.',
        code: 'PHONE_NODE_UNCONFIGURED',
      };
    }

    const action = String(params.action ?? 'shell').toLowerCase();
    const timeoutMs = Math.min(
      120_000,
      Math.max(5_000, Number(params.timeout_seconds ?? 30) * 1000),
    );

    const cmd = action === 'ping'
      ? enqueueNodeCommand(nodeId, 'ping', {})
      : (() => {
        const command = String(params.command ?? '').trim();
        if (!command) return null;
        return dispatchNodeShellCommand(nodeId, command);
      })();

    if (!cmd) return { error: 'command is required for shell action' };

    if (action === 'ping') {
      pushNodeCommand(nodeId, cmd);
    }

    const finished = await waitForNodeCommand(cmd.id, timeoutMs);
    if (!finished?.completedAt) {
      return { nodeId, commandId: cmd.id, status: 'timeout', error: 'Timed out waiting for phone node response' };
    }
    return {
      nodeId,
      commandId: cmd.id,
      status: finished.error ? 'failed' : 'completed',
      result: finished.result,
      error: finished.error,
    };
  },
};
