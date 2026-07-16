import type { InboundMessage } from '../types.js';
import { getCommand } from './registry.js';

export interface SlashInterceptResult {
  handled: boolean;
  response?: string;
}

export async function interceptSlashCommand(
  msg: InboundMessage,
  workerId: string,
): Promise<SlashInterceptResult> {
  const text = msg.content?.trim() ?? '';
  if (!text.startsWith('/')) return { handled: false };

  const parts = text.split(/\s+/);
  const cmdName = (parts[0]?.slice(1) ?? '').toLowerCase();
  if (!cmdName) return { handled: false };

  const cmd = getCommand(cmdName);
  if (!cmd) {
    return { handled: true, response: `Unknown command: /${cmdName}. Type /help for available commands.` };
  }

  const response = await cmd.handler(msg, workerId);
  return { handled: true, response };
}
