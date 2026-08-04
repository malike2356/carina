import type { SlashCommand } from './registry.js';
import { listCommands } from './registry.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show available slash commands',
  async handler() {
    const cmds = listCommands();
    const lines = ['Aiva slash commands:', ''];
    for (const cmd of cmds) {
      lines.push(`/${cmd.name.replace(/-/g, '_')} - ${cmd.description}`);
    }
    lines.push(
      '',
      'Memory tip: /memory shows USER+MEMORY budgets; /search finds old chats; /remember saves durable facts.',
      'Channel sync: /link code then /link claim <code> on another channel; /chats lists pullable threads.',
      'Config tip: /voice_on /voice_off; /incognito_on /incognito_off; /config shows current toggles.',
      'BYOK tip: /byok set <provider> <api_key> stores your LLM key for this Aiva (never echoed back).',
    );
    return lines.join('\n');
  },
};
