import {
  bashWords,
  getNestedOptions,
  getSubcommands,
  getTopLevelCommands,
} from './shared.js';

function generateBashSubCases(): string {
  const subcommands = getSubcommands();
  const nested = getNestedOptions();
  return Object.entries(subcommands).map(([cmd, subs]) => {
    const subWords = bashWords(subs);
    let nestedCases = '';
    const nestedForCmd = nested[cmd];
    if (nestedForCmd) {
      nestedCases = Object.entries(nestedForCmd).map(([sub, opts]) => {
        if (opts.length === 0) return '';
        return `
      ${sub})
        if (( COMP_CWORD == 3 )); then
          COMPREPLY=( $(compgen -W "${bashWords(opts)}" -- "\${cur}") )
        fi
        return
;`;
      }).join('');
    }
    return `
    ${cmd})
      if (( COMP_CWORD == 2 )); then
        COMPREPLY=( $(compgen -W "${subWords}" -- "\${cur}") )
        return
      fi${nestedCases}
;`;
  }).join('');
}

function generateBashDynamicBlock(): string {
  return `
    # Dynamic completions (fail silently when Carina is unavailable)
    case "\${prev}" in
      --session|-s)
        COMPREPLY=( $(compgen -W "$(carina completion dynamic session-id 2>/dev/null)" -- "\${cur}") )
        return
;
      --skill)
        COMPREPLY=( $(compgen -W "$(carina completion dynamic skill-name 2>/dev/null)" -- "\${cur}") )
        return
;
      --model)
        COMPREPLY=( $(compgen -W "$(carina completion dynamic model-id 2>/dev/null)" -- "\${cur}") )
        return
;
      --workspace)
        COMPREPLY=( $(compgen -W "$(carina completion dynamic workspace-id 2>/dev/null)" -- "\${cur}") )
        return
;
      resume|delete|rename|export|share|stats|show)
        if [[ "\${words[1]}" == "session" || "\${words[1]}" == "s" || "\${words[1]}" == "sessions" ]]; then
          COMPREPLY=( $(compgen -W "$(carina completion dynamic session-id 2>/dev/null)" -- "\${cur}") )
          return
        fi
;
      install|uninstall|enable|disable|info)
        if [[ "\${words[1]}" == "skill" || "\${words[1]}" == "sk" || "\${words[1]}" == "skills" || "\${words[1]}" == "packs" ]]; then
          COMPREPLY=( $(compgen -W "$(carina completion dynamic skill-name 2>/dev/null)" -- "\${cur}") )
          return
        fi
;
      use|set|test)
        if [[ "\${words[1]}" == "model" || "\${words[1]}" == "m" ]]; then
          COMPREPLY=( $(compgen -W "$(carina completion dynamic model-id 2>/dev/null)" -- "\${cur}") )
          return
        fi
;
      switch|rename|delete|current)
        if [[ "\${words[1]}" == "workspace" || "\${words[1]}" == "ws" ]]; then
          COMPREPLY=( $(compgen -W "$(carina completion dynamic workspace-id 2>/dev/null)" -- "\${cur}") )
          return
        fi
;
    esac`;
}

export function generateBash(): string {
  const top = bashWords(getTopLevelCommands());
  const subCases = generateBashSubCases();
  const dynamicBlock = generateBashDynamicBlock();

  return `# Carina bash completion
# Source this file or add to ~/.bashrc:
#   source <(carina completion bash)

_carina_complete() {
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
      return
;
    completion)
      if (( COMP_CWORD == 2 )); then
        COMPREPLY=( $(compgen -W "bash zsh fish powershell dynamic" -- "\${cur}") )
        return
      fi
      if (( COMP_CWORD == 3 )) && [[ "\${COMP_WORDS[2]}" == "dynamic" ]]; then
        COMPREPLY=( $(compgen -W "session-id session-name skill-name model-id workspace-id" -- "\${cur}") )
        return
      fi
;
${subCases}
  esac
${dynamicBlock}
}

complete -F _carina_complete carina
`;
}
