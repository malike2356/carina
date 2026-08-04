import type { ChannelMessage } from '../channel-adapter.interface.js';

export interface SlashCommand {
  name: string;
  description: string;
  handler: (msg: ChannelMessage) => Promise<string>;
}

const commands = new Map<string, SlashCommand>();

export function registerCommand(cmd: SlashCommand): void {
  commands.set(cmd.name, cmd);
}

export function getCommand(name: string): SlashCommand | undefined {
  return commands.get(name);
}

export function listCommands(): SlashCommand[] {
  return Array.from(commands.values());
}
