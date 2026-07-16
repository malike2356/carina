import type { SlashCommand } from './registry.js';

export const stopCommand: SlashCommand = {
  name: 'stop',
  description: 'Cancel the current task',
  async handler() {
    return 'No active task to cancel. (Note: tasks that have already begun tool execution cannot be interrupted mid-flight via slash command.)';
  },
};
