import { getNestedOptions, getSubcommands, getTopLevelCommands } from './shared.js';

export function generateZsh(): string {
  const top = getTopLevelCommands().map((c) => `'${c}'`).join(' ');
  const subcommands = getSubcommands();
  const nested = getNestedOptions();

  const nestedHandlers = Object.entries(nested)
    .filter(([, nestedForCmd]) => Object.values(nestedForCmd).some((opts) => opts.length > 0))
    .map(([cmd, nestedForCmd]) => {
      const cases = Object.entries(nestedForCmd)
        .filter(([, opts]) => opts.length > 0)
        .map(([sub, opts]) => `
      ${sub})
        _values 'option' ${opts.map((o) => `'${o}'`).join(' ')}
;`)
        .join('');
      return `
  case $state in
    ${cmd}_nested)
      case $words[2] in${cases}
      esac
;
  esac`;
    }).join('');

  const subcommandCases = Object.entries(subcommands).map(([cmd, subs]) => `        ${cmd}|${aliasFor(cmd)})
          _values 'subcommand' ${subs.map((s) => `'${s}'`).join(' ')}
;`).join('\n');

  function aliasFor(cmd: string): string {
    const aliases: Record<string, string> = {
      workspace: 'ws',
      session: 's',
      memory: 'mem',
      model: 'm',
      task: 't',
      skill: 'sk',
      agent: 'a',
      webhook: 'wh',
      scout: 'sec',
      channel: 'ch',
      config: 'cfg',
    };
    return aliases[cmd] ?? cmd;
  }

  return `#compdef carina

# Carina zsh completion
# Add to your zsh config:
#   eval "$(carina completion zsh)"

_carina() {
  local state

  _arguments -C \\
    '1: :->command' \\
    '*:: :->args'

  case $state in
    command)
      _values 'command' ${top} help version
;
    args)
      local cmd=$words[1]
      case $cmd in
${subcommandCases}
      esac
;${nestedHandlers}
  esac
}

_carina
`;
}
