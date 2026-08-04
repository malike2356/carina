import type { ChannelMessage } from '../channel-adapter.interface.js';
import { getCommand } from './registry.js';
import { byokShouldDeleteInbound } from './byok-commands.js';

export interface SlashInterceptResult {
  handled: boolean;
  response?: string;
  /** When true, gateway should delete the user's inbound message (e.g. /byok set). */
  deleteInbound?: boolean;
}

export async function interceptSlashCommand(msg: ChannelMessage): Promise<SlashInterceptResult> {
  const text = msg.text.trim();
  if (!text.startsWith('/')) return { handled: false };

  const parts = text.split(/\s+/);
  const cmdName = (parts[0]?.slice(1).split('@')[0] ?? '')
    .toLowerCase()
    .replace(/_/g, '-');
  if (!cmdName) return { handled: false };

  const cmd = getCommand(cmdName);

  if (!cmd) {
    return {
      handled: true,
      response: `Unknown command: /${cmdName}. Type /help for available commands.`,
    };
  }

  const response = await cmd.handler(msg);
  const deleteInbound = cmdName === 'byok' && byokShouldDeleteInbound(msg);
  return { handled: true, response, deleteInbound };
}
