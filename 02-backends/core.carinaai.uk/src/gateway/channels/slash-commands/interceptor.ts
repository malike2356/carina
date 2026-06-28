import type { ChannelMessage } from '../channel-adapter.interface.js';
import { getCommand } from './registry.js';

export interface SlashInterceptResult {
  handled: boolean;
  response?: string;
}

export async function interceptSlashCommand(msg: ChannelMessage): Promise<SlashInterceptResult> {
  const text = msg.text.trim();
  if (!text.startsWith('/')) return { handled: false };

  const parts = text.split(/\s+/);
  const cmdName = (parts[0]?.slice(1) ?? '').toLowerCase();
  const cmd = getCommand(cmdName);

  if (!cmd) {
    return {
      handled: true,
      response: `Unknown command: /${cmdName}. Type /help for available commands.`,
    };
  }

  const response = await cmd.handler(msg);
  return { handled: true, response };
}
