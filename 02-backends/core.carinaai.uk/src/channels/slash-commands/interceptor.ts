import type { InboundMessage } from '../types.js';
import { getCommand } from './registry.js';
import { byokShouldDeleteInbound } from './byok-commands.js';

export interface SlashInterceptResult {
  handled: boolean;
  response?: string;
  /** When true, channel adapter should delete the user's inbound message (e.g. /byok set). */
  deleteInbound?: boolean;
  /** Optional Document Vault export attachment for Telegram sendDocument. */
  attach?: {
    filename: string;
    mime: string;
    contentBase64: string;
  };
}

export async function interceptSlashCommand(
  msg: InboundMessage,
  workerId: string,
): Promise<SlashInterceptResult> {
  const text = msg.content?.trim() ?? '';
  if (!text.startsWith('/')) return { handled: false };

  const parts = text.split(/\s+/);
  const cmdName = (parts[0]?.slice(1).split('@')[0] ?? '')
    .toLowerCase()
    .replace(/_/g, '-');
  if (!cmdName) return { handled: false };

  const cmd = getCommand(cmdName);
  if (!cmd) {
    return { handled: true, response: `Unknown command: /${cmdName}. Type /help for available commands.` };
  }

  const response = await cmd.handler(msg, workerId);
  const deleteInbound = cmdName === 'byok' && byokShouldDeleteInbound(msg);
  if (typeof response === 'string') {
    return { handled: true, response, deleteInbound };
  }
  return {
    handled: true,
    response: response.text,
    deleteInbound,
    attach: response.attach,
  };
}
