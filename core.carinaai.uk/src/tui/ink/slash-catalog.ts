import { SUBCOMMANDS } from '../../cli/completion-metadata.js';

export type SlashCommand = {
  name: string;
  description: string;
  insert: string;
};

const TUI_SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help', description: 'Show interactive commands', insert: '/help' },
  { name: 'new', description: 'Start a fresh session', insert: '/new' },
  { name: 'reset', description: 'Reset current session', insert: '/reset' },
  { name: 'retry', description: 'Resend last message', insert: '/retry' },
  { name: 'clear', description: 'Clear message display', insert: '/clear' },
  { name: 'model', description: 'Open model picker (Ctrl+M)', insert: '/model' },
  { name: 'session', description: 'Open session switcher (Ctrl+S)', insert: '/session' },
  { name: 'skin', description: 'Switch terminal color theme', insert: '/skin ' },
  { name: 'scout status', description: 'Open Scout security overlay (Ctrl+Shift+S)', insert: '/scout status' },
  { name: 'quit', description: 'Exit Carina', insert: '/quit' },
];

export function buildSlashCatalog(): SlashCommand[] {
  const cliCommands: SlashCommand[] = [];
  for (const [group, subs] of Object.entries(SUBCOMMANDS)) {
    for (const sub of subs) {
      if (sub.startsWith('--')) continue;
      cliCommands.push({
        name: `${group} ${sub}`,
        description: `carina ${group} ${sub}`,
        insert: `/${group} ${sub}`,
      });
    }
  }
  return [...TUI_SLASH_COMMANDS, ...cliCommands];
}

export function fuzzyScore(name: string, query: string): number {
  if (!query) return 1;
  let qi = 0;
  let score = 0;
  for (let i = 0; i < name.length && qi < query.length; i++) {
    if (name[i]!.toLowerCase() === query[qi]!.toLowerCase()) {
      score += (qi === 0 || name[i - 1] === ' ' || name[i - 1] === '-') ? 10 : 1;
      qi++;
    }
  }
  return qi === query.length ? score : 0;
}

export function filterSlashCommands(commands: SlashCommand[], query: string, limit = 8): SlashCommand[] {
  return commands
    .map((cmd) => ({ cmd, score: fuzzyScore(cmd.name, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ cmd }) => cmd);
}
