import {
  buildTuiCommandRegistry,
  formatArgHint,
  getCommandAliases,
  type TuiCommandDefinition,
} from '../commands/registry.js';

export type SlashCommand = {
  name: string;
  description: string;
  insert: string;
  argHint?: string;
  examples?: string[];
  source?: TuiCommandDefinition['source'];
  handlerKind?: TuiCommandDefinition['handlerKind'];
  dangerLevel?: TuiCommandDefinition['dangerLevel'];
};

export function buildSlashCatalog(): SlashCommand[] {
  return buildTuiCommandRegistry().flatMap((command) => getCommandAliases(command).map((alias) => ({
    name: alias,
    description: command.description,
    insert: `/${alias}${command.args.length > 0 ? ' ' : ''}`,
    argHint: formatArgHint(command),
    examples: command.examples,
    source: command.source,
    handlerKind: command.handlerKind,
    dangerLevel: command.dangerLevel,
  })));
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
