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
      ...cmds.map((c) => `/${c.name.replace(/-/g, '_')}  -  ${c.description}`),
      '',
      'Also: /start | /history [N] | /speak [message] | /model [provider] [model]',
      'Memory: /memory | /remember <text> | /forget <id|text> | /search <query> | /clear',
      'Voice: /voice_on /voice_off  |  Config: /config  |  BYOK: /byok set|clear|list|claim',
    ];
    return lines.join('\n');
  },
};
