import {
  NESTED_OPTIONS,
  SUBCOMMANDS,
  TOP_LEVEL_COMMANDS,
} from '../completion-metadata.js';

function bashWords(values: readonly string[]): string {
  return values.join(' ');
}

export function buildBashCompletionScript(): string {
  const top = bashWords(TOP_LEVEL_COMMANDS);
  const subCases = Object.entries(SUBCOMMANDS).map(([cmd, subs]) => {
    const subWords = bashWords(subs);
    const nested = NESTED_OPTIONS[cmd];
    let nestedCases = '';
    if (nested) {
      const parts = Object.entries(nested).map(([sub, opts]) => {
        if (opts.length === 0) return '';
        return `
      ${sub})
        if (( cword == 3 )); then
          COMPREPLY=( $(compgen -W "${bashWords(opts)}" -- "\${cur}") )
        fi
        return
;`;
      }).join('');
      nestedCases = parts;
    }
    return `
    ${cmd})
      if (( cword == 2 )); then
        COMPREPLY=( $(compgen -W "${subWords}" -- "\${cur}") )
        return
      fi${nestedCases}
;`;
  }).join('');

  return `# Carina CLI bash completion
# Usage: eval "$(carina completion bash)"

_carina_completion() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if (( COMP_CWORD == 1 )); then
    COMPREPLY=( $(compgen -W "${top} help --help -h --version -v" -- "\${cur}") )
    return
  fi

  local cmd="\${COMP_WORDS[1]}"
  case "\${cmd}" in
    help|-h|--help)
      if (( COMP_CWORD == 2 )); then
        COMPREPLY=( $(compgen -W "${top}" -- "\${cur}") )
      fi
;
    completion)
      if (( COMP_CWORD == 2 )); then
        COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      fi
;
${subCases}
  esac
}

complete -F _carina_completion carina
`;
}

export function buildZshCompletionScript(): string {
  const top = TOP_LEVEL_COMMANDS.map((c) => `'${c}'`).join(' ');
  const subSpecs = Object.entries(SUBCOMMANDS).map(([cmd, subs]) => {
    const subList = subs.map((s) => `'${s}'`).join(' ');
    const nested = NESTED_OPTIONS[cmd];
    if (!nested || Object.keys(nested).length === 0) {
      return `    '${cmd}:sub:${subList}'`;
    }
    const nestedSpecs = Object.entries(nested)
      .filter(([, opts]) => opts.length > 0)
      .map(([sub, opts]) => `'${sub}:${opts.map((o) => `'${o}'`).join(' ')}'`)
      .join(' ');
    return `    '${cmd}:subcmd:(${subList}):->${cmd}_nested'`;
  }).join(' \\\n');

  const nestedHandlers = Object.entries(NESTED_OPTIONS)
    .filter(([, nested]) => Object.values(nested).some((opts) => opts.length > 0))
    .map(([cmd, nested]) => {
      const cases = Object.entries(nested)
        .filter(([, opts]) => opts.length > 0)
        .map(([sub, opts]) => `
      ${sub})
        _values 'option' ${opts.map((o) => `'${o}'`).join(' ')}
;`)
        .join('');
      return `
  case \$state in
    ${cmd}_nested)
      case \$words[2] in${cases}
      esac
;
  esac`;
    }).join('');

  return `#compdef carina

_carina() {
  local -a commands
  commands=(
${subSpecs}
  )

  _arguments -C \\
    '1: :->command' \\
    '*:: :->args'

  case \$state in
    command)
      _values 'command' ${top} help version
;
    args)
      local cmd=\$words[1]
      case \$cmd in
${Object.entries(SUBCOMMANDS).map(([cmd, subs]) => `        ${cmd})
          _values 'subcommand' ${subs.map((s) => `'${s}'`).join(' ')}
;`).join('\n')}
      esac
;${nestedHandlers}
  esac
}

_carina
`;
}

export function buildFishCompletionScript(): string {
  const lines = [
    '# Carina CLI fish completion',
    '# Save to ~/.config/fish/completions/carina.fish',
    '',
    `complete -c carina -f`,
    `complete -c carina -n '__fish_use_subcommand' -a '${TOP_LEVEL_COMMANDS.join(' ')}'`,
  ];

  for (const [cmd, subs] of Object.entries(SUBCOMMANDS)) {
    lines.push(`complete -c carina -n '__fish_seen_subcommand_from ${cmd}' -a '${subs.join(' ')}'`);
    const nested = NESTED_OPTIONS[cmd];
    if (!nested) continue;
    for (const [sub, opts] of Object.entries(nested)) {
      if (opts.length === 0) continue;
      lines.push(
        `complete -c carina -n '__fish_seen_subcommand_from ${cmd}; and __fish_seen_subcommand_from ${sub}' -a '${opts.join(' ')}'`,
      );
    }
  }

  lines.push(`complete -c carina -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'`);
  return `${lines.join('\n')}\n`;
}

export async function runCompletionCommand(args: string[]): Promise<void> {
  const shell = args[0] ?? 'bash';

  if (shell === 'bash') {
    console.log(buildBashCompletionScript());
    return;
  }

  if (shell === 'zsh') {
    console.log(buildZshCompletionScript());
    return;
  }

  if (shell === 'fish') {
    console.log(buildFishCompletionScript());
    return;
  }

  console.error('Usage: carina completion <bash|zsh|fish>');
  process.exit(1);
}
