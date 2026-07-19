import type { SlashCommand } from './registry.js';
import { listCommands } from './registry.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show available slash commands',
  handler: async (_msg) => {
    const cmds = listCommands();
    const lines = [
      'Carina slash commands:',
      '',
      ...cmds.map((c) => `/${c.name}  -  ${c.description}`),
      '',
      'Memory: /memory | /remember <text> | /forget <id|text> | /search <query> | /clear',
    ];
    return lines.join('\n');
  },
};
