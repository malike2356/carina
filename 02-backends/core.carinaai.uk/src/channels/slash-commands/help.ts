import type { SlashCommand } from './registry.js';
import { listCommands } from './registry.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show available slash commands',
  async handler() {
    const cmds = listCommands();
    const lines = ['Carina slash commands:', ''];
    for (const cmd of cmds) {
      lines.push(`/${cmd.name} - ${cmd.description}`);
    }
    return lines.join('\n');
  },
};
