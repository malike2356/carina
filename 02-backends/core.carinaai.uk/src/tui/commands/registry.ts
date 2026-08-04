import { SUBCOMMANDS } from '../../cli/completion-metadata.js';

export type CommandSource = 'local' | 'backend' | 'skill' | 'plugin' | 'system';
export type HandlerKind = 'local' | 'backend' | 'panel' | 'turn' | 'external';
export type DangerLevel = 'safe' | 'confirm' | 'danger';

export interface CommandArg {
  name: string;
  hint: string;
  required?: boolean;
}

export interface TuiCommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  args: CommandArg[];
  examples: string[];
  source: CommandSource;
  requiresSession: boolean;
  dangerLevel: DangerLevel;
  handlerKind: HandlerKind;
}

export interface CommandMatch {
  definition: TuiCommandDefinition;
  alias: string;
  argText: string;
}

const LOCAL_COMMANDS: TuiCommandDefinition[] = [
  local('help', ['?'], 'Show interactive commands', [], ['/help', '/?']),
  local('quit', ['exit', 'q'], 'Exit Carina', [], ['/quit']),
  local('new', ['reset'], 'Start a fresh session', [], ['/new']),
  panel('session', ['sessions', 'resume'], 'Open session switcher', [], ['/session']),
  panel('fork', [], 'Fork the current session', [], ['/fork']),
  panel('model', ['provider'], 'Open model picker', [], ['/model']),
  panel('skin', ['theme'], 'Switch terminal appearance', [{ name: 'theme', hint: 'theme name' }], ['/skin sentinel']),
  local('clear', [], 'Clear message display', [], ['/clear']),
  turn('retry', [], 'Resend the last message', [], ['/retry']),
  turn('stop', ['interrupt'], 'Interrupt the current turn', [], ['/stop']),
  panel('tasks', ['cron'], 'Open scheduled tasks', [], ['/tasks']),
  backend('tools', [], 'Inspect available tools', [], ['/tools']),
  backend('memory', ['memories'], 'List recent memories', [], ['/memory']),
  panel('scout', ['scout status'], 'Open Scout security status', [], ['/scout']),
  panel('agent', ['agents'], 'Open worker agent status', [], ['/agent']),
  panel('debug', [], 'Open debug status', [], ['/debug']),
  panel('timeline', ['events'], 'Open runtime timeline', [], ['/timeline']),
  panel('details', [], 'Set detail sections', [{ name: 'section mode', hint: 'tools expanded' }], ['/details tools expanded']),
  panel('search', [], 'Search transcript history', [{ name: 'query', hint: 'search terms' }], ['/search invoice']),
  panel('review', ['search'], 'Open review mode', [], ['/review']),
  local('copy', [], 'Copy the latest reply when supported', [], ['/copy']),
  external('export', [], 'Export transcript when supported', [{ name: 'format', hint: 'markdown | json' }], ['/export markdown']),
  external('open', [], 'Open a referenced link or file when supported', [{ name: 'target', hint: 'url or path' }], ['/open 1']),
  backend('status', [], 'Show runtime status', [], ['/status']),
  backend('doctor', [], 'Run local health checks', [{ name: 'mode', hint: '--fix optional' }], ['/doctor', '/doctor --fix']),
  backend('usage', [], 'Show usage summary', [{ name: 'period', hint: '--month optional' }], ['/usage --month']),
  backend('config', [], 'Show configuration help', [], ['/config']),
];

function local(
  name: string,
  aliases: string[],
  description: string,
  args: CommandArg[],
  examples: string[],
): TuiCommandDefinition {
  return command(name, aliases, description, args, examples, 'local', 'local');
}

function panel(
  name: string,
  aliases: string[],
  description: string,
  args: CommandArg[],
  examples: string[],
): TuiCommandDefinition {
  return command(name, aliases, description, args, examples, 'local', 'panel');
}

function turn(
  name: string,
  aliases: string[],
  description: string,
  args: CommandArg[],
  examples: string[],
): TuiCommandDefinition {
  return command(name, aliases, description, args, examples, 'local', 'turn');
}

function backend(
  name: string,
  aliases: string[],
  description: string,
  args: CommandArg[],
  examples: string[],
): TuiCommandDefinition {
  return command(name, aliases, description, args, examples, 'backend', 'backend');
}

function external(
  name: string,
  aliases: string[],
  description: string,
  args: CommandArg[],
  examples: string[],
): TuiCommandDefinition {
  return command(name, aliases, description, args, examples, 'local', 'external');
}

function command(
  name: string,
  aliases: string[],
  description: string,
  args: CommandArg[],
  examples: string[],
  source: CommandSource,
  handlerKind: HandlerKind,
): TuiCommandDefinition {
  return {
    name,
    aliases,
    description,
    args,
    examples,
    source,
    requiresSession: true,
    dangerLevel: 'safe',
    handlerKind,
  };
}

export function buildTuiCommandRegistry(): TuiCommandDefinition[] {
  const commands = new Map<string, TuiCommandDefinition>();
  for (const command of LOCAL_COMMANDS) {
    commands.set(command.name, command);
  }

  for (const [group, subs] of Object.entries(SUBCOMMANDS)) {
    for (const sub of subs) {
      if (sub.startsWith('--')) continue;
      const name = `${group} ${sub}`;
      if (commands.has(name)) continue;
      commands.set(name, {
        name,
        aliases: [],
        description: `Run carina ${name}`,
        args: [],
        examples: [`/${name}`],
        source: 'backend',
        requiresSession: false,
        dangerLevel: name.includes('delete') || name.includes('remove') ? 'confirm' : 'safe',
        handlerKind: 'backend',
      });
    }
  }

  return [...commands.values()];
}

export function getCommandAliases(command: TuiCommandDefinition): string[] {
  return [command.name, ...command.aliases].filter(Boolean);
}

export function matchTuiCommand(
  input: string,
  registry: TuiCommandDefinition[] = buildTuiCommandRegistry(),
): CommandMatch | undefined {
  const body = input.trim().replace(/^\/+/, '').toLowerCase();
  if (!body) return undefined;

  const candidates: CommandMatch[] = [];
  for (const definition of registry) {
    for (const alias of getCommandAliases(definition)) {
      const normalizedAlias = alias.toLowerCase();
      if (body === normalizedAlias || body.startsWith(`${normalizedAlias} `)) {
        candidates.push({
          definition,
          alias,
          argText: body === normalizedAlias ? '' : input.trim().replace(/^\/+/, '').slice(alias.length).trim(),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.alias.length - a.alias.length)[0];
}

export function formatArgHint(command: TuiCommandDefinition): string {
  if (command.args.length === 0) return '';
  return command.args
    .map((arg) => (arg.required ? `<${arg.hint}>` : `[${arg.hint}]`))
    .join(' ');
}

export function sanitizeCommandError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const withoutStack = raw.split('\n')[0] ?? 'Command unavailable.';
  return withoutStack
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(?:sk|pk|rk|whsec|xoxb|ghp|github_pat)_[A-Za-z0-9_=-]{8,}\b/g, '[secret]')
    .replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, '$1=[redacted]')
    .slice(0, 180);
}

export function formatUnavailableCommand(input: string): string {
  const name = input.trim().split(/\s+/)[0] ?? '/command';
  return `${name} is unavailable in this TUI session. Type /help to see supported commands.`;
}
