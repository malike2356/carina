import type { InboundMessage } from '../types.js';

export interface SlashCommand {
  name: string;
  description: string;
  handler: (msg: InboundMessage, workerId: string) => Promise<string | {
    text: string;
    attach?: { filename: string; mime: string; contentBase64: string };
  }>;
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
