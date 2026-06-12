import { DEFAULT_POLICY } from './tool-policy.js';
import { appendApprovalAudit } from './approval-store.js';

export type NodeCommandDecision =
  | { allowed: true }
  | { allowed: false; reason: string; pattern?: string };

export function nodeShellPolicyEnabled(): boolean {
  return process.env.CARINA_NODE_SHELL_POLICY !== 'off';
}

export function evaluateNodeShellCommand(command: string): NodeCommandDecision {
  if (!nodeShellPolicyEnabled()) return { allowed: true };
  const trimmed = command.trim();
  if (!trimmed) return { allowed: false, reason: 'empty command' };

  for (const re of DEFAULT_POLICY.dangerousCommands) {
    if (re.test(trimmed)) {
      appendApprovalAudit({
        action: 'node.shell.blocked',
        tool: 'node-shell',
        scope: 'global',
        detail: re.toString(),
      });
      return {
        allowed: false,
        reason: `Command blocked by node shell policy (matched ${re.toString()})`,
        pattern: re.toString(),
      };
    }
  }

  return { allowed: true };
}
