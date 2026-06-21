# Prompt 05: Shell Completions


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

With 150+ CLI commands, tab completion becomes essential for usability. Operators need
to be able to type `carina me<Tab>` and see `memory`, or `carina memory li<Tab>` and
get `list`. Completions should work for bash, zsh, and fish.

## What to Build

### 1. Completion generator

Commander.js supports `--get-yargs-completions` natively but we use Commander, which
does not have built-in completion generation. Use `omelette` as a completion library:

```bash
pnpm add omelette
```

Create `src/cli/completions.ts`:
```typescript
import omelette from 'omelette';

export function registerCompletions(): void {
  const completion = omelette('carina <command> <subcommand>');

  completion.on('command', ({ reply }) => {
    reply([
      'ask', 'chat', 'memory', 'project', 'channel', 'scout', 'skills',
      'tools', 'distro', 'session', 'doctor', 'config', 'logs', 'health',
      'version', 'update', 'setup', 'ingest',
    ]);
  });

  completion.on('subcommand', ({ before, reply }) => {
    const subcommands: Record<string, string[]> = {
      memory: ['list', 'search', 'show', 'edit', 'delete', 'export', 'import', 'prune', 'stats', 'link'],
      project: ['list', 'create', 'show', 'archive', 'delete', 'switch', 'export', 'members'],
      channel: ['list', 'connect', 'test', 'disconnect', 'send', 'history', 'enable', 'disable', 'status', 'logs'],
      scout: ['status', 'score', 'events', 'alerts', 'suppress', 'policies', 'kill-switch', 'report'],
      skills: ['list', 'show', 'install', 'uninstall', 'run', 'update', 'publish', 'validate'],
      tools: ['list', 'show', 'run', 'test', 'enable', 'disable'],
      distro: ['create', 'list', 'dev', 'build', 'deploy', 'validate', 'doctor', 'add', 'publish'],
      session: ['list', 'show', 'export', 'delete', 'archive', 'search'],
      config: ['list', 'get', 'set', 'reset'],
    };
    reply(subcommands[before] ?? []);
  });

  completion.init();
}
```

### 2. Installation command

Add `carina completions install` command:
```bash
carina completions install           # auto-detect shell and install
carina completions install --shell bash
carina completions install --shell zsh
carina completions install --shell fish
carina completions show --shell bash  # print completion script (for manual install)
```

The install command writes the completion setup to:
- bash: `~/.bash_completion.d/carina`
- zsh: `~/.zsh/completions/_carina`
- fish: `~/.config/fish/completions/carina.fish`

### 3. Bash completion

Generated format:
```bash
_carina_completions() {
  local cur prev
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  local commands="ask chat memory project channel scout skills tools distro session doctor config version"

  case "$prev" in
    memory) COMPREPLY=($(compgen -W "list search show edit delete export import prune stats" -- "$cur"));
    project) COMPREPLY=($(compgen -W "list create show archive delete switch export" -- "$cur"));
    *) COMPREPLY=($(compgen -W "$commands" -- "$cur"));
  esac
}
complete -F _carina_completions carina
```

### 4. Zsh completion

```zsh
#compdef carina

_carina() {
  local state

  _arguments \
    '1: :->command' \
    '2: :->subcommand'

  case $state in
    command) _values 'commands' ask chat memory project channel scout skills tools distro session;
    subcommand)
      case $words[2] in
        memory) _values 'subcommands' list search show edit delete export import prune stats;
        project) _values 'subcommands' list create show archive delete switch export;
      esac
;
  esac
}
_carina "$@"
```

### 5. Fish completion

```fish
complete -c carina -f -n '__fish_use_subcommand' -a memory -d 'Manage memory'
complete -c carina -f -n '__fish_use_subcommand' -a project -d 'Manage projects'
complete -c carina -f -n '__fish_seen_subcommand_from memory' -a list -d 'List memory entries'
complete -c carina -f -n '__fish_seen_subcommand_from memory' -a search -d 'Search memory'
# ... all other subcommands
```

## Verification Checklist

- [ ] `carina completions install --shell bash` writes file to ~/.bash_completion.d/
- [ ] After sourcing, `carina me<Tab>` completes to `memory`
- [ ] `carina memory <Tab>` shows list of memory subcommands
- [ ] `carina completions show --shell zsh` prints zsh completion script to stdout
- [ ] Fish completions work after installing fish script

## Files to Create or Modify

- CREATE `src/cli/completions.ts`
- MODIFY `bin/carina.ts` - add `completions` command, call `registerCompletions()`
- MODIFY `package.json` - add omelette dependency
