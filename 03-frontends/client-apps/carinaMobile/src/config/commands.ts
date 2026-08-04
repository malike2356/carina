export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: 'Show available commands' },
  { command: '/provider', description: 'Switch LLM provider' },
  { command: '/model list', description: 'List configured providers' },
  { command: '/memories', description: 'List episodic memories' },
  { command: '/usage --month', description: 'Token usage and estimated cost' },
  { command: '/clear-cache', description: 'Clear cached tool results' },
  { command: '/clear', description: 'Reset session memory' },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed.startsWith('/')) return [];
  if (trimmed === '/') return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((item) => item.command.toLowerCase().startsWith(trimmed));
}

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}
