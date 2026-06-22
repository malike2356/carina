**Status: COMPLETED 2026-06-21**

**What was built:**
- `src/cli/completions/bash.ts` - bash _carina_complete function
- `src/cli/completions/zsh.ts` - zsh #compdef _carina
- `src/cli/completions/fish.ts` - fish complete lines
- `src/cli/completions/powershell.ts` - PowerShell Register-ArgumentCompleter
- `src/cli/completions/dynamic.ts` - live session/skill/model ID fetcher
- `src/cli/completions/generate.ts` - orchestrator
- `src/cli/commands/completion/index.ts` - `carina completion <shell> [--install]`

# Gap 07 - Prompt 05: Shell Completions

**Agent:** Codex (fallback: Claude Code)
**Estimated hours:** 3-4 hrs
**Depends on:** 04-cli-command-expansion.md done (all commands registered)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

```
core.carinaai.uk/src/cli/completion-metadata.ts   (EXISTS - scaffold to extend)
core.carinaai.uk/src/cli/registry.ts              (all registered commands)
core.carinaai.uk/bin/carina.ts                    (CLI entry point)
```

---

## Goal

Produce working completion scripts for bash, zsh, fish, and PowerShell. Also produce a `carina completion` command that installs them. The completions must handle static items (command names, flags) and dynamic items (session IDs, skill names, model names).

---

## 1. Static Completion Generator (`src/cli/completions/generate.ts`)

This script reads the registry and generates all four completion scripts:

```typescript
import { registry } from '../registry';

interface CompletionScript {
  bash: string;
  zsh: string;
  fish: string;
  powershell: string;
}

export function generateCompletions(): CompletionScript {
  const commands = registry.getAllCommands();
  const commandNames = commands.map(c => c.name);
  const aliases = registry.getAllAliases();

  return {
    bash: generateBash(commands, aliases),
    zsh: generateZsh(commands, aliases),
    fish: generateFish(commands, aliases),
    powershell: generatePowerShell(commands, aliases),
  };
}
```

---

## 2. Bash Completion (`src/cli/completions/bash.ts`)

```typescript
export function generateBash(commands: Command[], aliases: Alias[]): string {
  const allNames = [...commands.map(c => c.name), ...aliases.map(a => a.from)];
  const grouped = groupByFirstWord(commands);

  return `
# Carina bash completion
# Source this file or add to ~/.bashrc:
#   source <(carina completion bash)

_carina_complete() {
    local cur prev words cword
    _init_completion || return

    local top_commands="${allNames.filter(n => !n.includes(' ')).join(' ')}"

    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "\${top_commands}" -- "\${cur}") )
        return
    fi

    local subcmd="\${words[1]}"
    case "\${subcmd}" in
${generateBashCases(grouped)}
    esac

    # Dynamic completions
    case "\${prev}" in
        --session|-s)
            COMPREPLY=( $(carina session list --json 2>/dev/null | jq -r '.[].id' | compgen -W "$(cat)" -- "\${cur}") )
;
        --skill)
            COMPREPLY=( $(carina skill list --json 2>/dev/null | jq -r '.[].name' | compgen -W "$(cat)" -- "\${cur}") )
;
        --model)
            COMPREPLY=( $(carina model list --json 2>/dev/null | jq -r '.[].id' | compgen -W "$(cat)" -- "\${cur}") )
;
        --workspace)
            COMPREPLY=( $(carina workspace list --json 2>/dev/null | jq -r '.[].id' | compgen -W "$(cat)" -- "\${cur}") )
;
    esac
}

complete -F _carina_complete carina
`;
}

function generateBashCases(grouped: Record<string, Command[]>): string {
  return Object.entries(grouped).map(([group, cmds]) => {
    const subnames = cmds.map(c => c.name.split(' ').slice(1).join(' ')).join(' ');
    return `        ${group})\n            COMPREPLY=( $(compgen -W "${subnames}" -- "\${cur}") )\n;`;
  }).join('\n');
}
```

---

## 3. Zsh Completion (`src/cli/completions/zsh.ts`)

```typescript
export function generateZsh(commands: Command[], aliases: Alias[]): string {
  const grouped = groupByFirstWord(commands);

  return `
#compdef carina

# Carina zsh completion
# Add to your zsh config:
#   eval "$(carina completion zsh)"

_carina() {
    local state

    _arguments \\
        '1: :->command' \\
        '*: :->args'

    case $state in
        command)
            _describe 'carina commands' "(
${commands.filter(c => !c.name.includes(' ')).map(c =>
  `                '${c.name}:${c.description}'`
).join('\n')}
            )"
;
        args)
            case $words[2] in
${Object.entries(grouped).map(([group, cmds]) => `                (${group})
                    _arguments \\
                        '1: :->subcommand' \\
                    case $state in
                        subcommand)
                            _describe '${group} subcommands' "(
${cmds.map(c => `                                '${c.name.split(' ').slice(1).join(' ')}:${c.description}'`).join('\n')}
                            )"
;
                    esac
;`).join('\n')}
            esac
;
    esac
}

_carina
`;
}
```

---

## 4. Fish Completion (`src/cli/completions/fish.ts`)

Fish has a simpler, line-by-line format:

```typescript
export function generateFish(commands: Command[], aliases: Alias[]): string {
  const lines: string[] = [
    '# Carina fish completion',
    '# Run: carina completion fish | source',
    '',
  ];

  // Top-level commands
  for (const cmd of commands.filter(c => !c.name.includes(' '))) {
    lines.push(
      `complete -c carina -f -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description}"`
    );
  }

  // Subcommands
  const grouped = groupByFirstWord(commands);
  for (const [group, cmds] of Object.entries(grouped)) {
    for (const cmd of cmds) {
      const sub = cmd.name.split(' ').slice(1).join(' ');
      lines.push(
        `complete -c carina -f -n "__fish_seen_subcommand_from ${group}" -a "${sub}" -d "${cmd.description}"`
      );
    }
  }

  // Common flags
  lines.push('');
  lines.push(`complete -c carina -l json -d "Output as JSON"`);
  lines.push(`complete -c carina -l help -s h -d "Show help"`);

  // Dynamic completions
  lines.push('');
  lines.push(`# Dynamic: session IDs`);
  lines.push(`complete -c carina -f -n "__fish_seen_subcommand_from resume" -a "(carina session list --json 2>/dev/null | jq -r '.[].id')"`);
  lines.push(`# Dynamic: skill names`);
  lines.push(`complete -c carina -f -n "__fish_seen_subcommand_from install uninstall enable disable" -a "(carina skill list --json 2>/dev/null | jq -r '.[].name')"`);

  return lines.join('\n');
}
```

---

## 5. PowerShell Completion (`src/cli/completions/powershell.ts`)

```typescript
export function generatePowerShell(commands: Command[], aliases: Alias[]): string {
  const grouped = groupByFirstWord(commands);

  const commandCases = Object.entries(grouped).map(([group, cmds]) => {
    const subItems = cmds.map(c => {
      const sub = c.name.split(' ').slice(1).join(' ');
      return `                    [CompletionResult]::new('${sub}', '${sub}', [CompletionResultType]::ParameterValue, '${c.description}')`;
    }).join('\n');
    return `                '${group}' {\n${subItems}\n                }`;
  }).join('\n');

  return `
# Carina PowerShell completion
# Add to your profile: carina completion powershell | Out-String | Invoke-Expression

Register-ArgumentCompleter -Native -CommandName carina -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $words = $commandAst.CommandElements
    $command = if ($words.Count -gt 1) { $words[1].Value } else { '' }
    $subcommand = if ($words.Count -gt 2) { $words[2].Value } else { '' }

    if ($words.Count -le 2) {
        # Top-level commands
        @(${commands.filter(c => !c.name.includes(' ')).map(c =>
          `            [CompletionResult]::new('${c.name}', '${c.name}', [CompletionResultType]::ParameterValue, '${c.description}')`
        ).join(',\n')}) |
            Where-Object { $_.CompletionText -like "$wordToComplete*" }
        return
    }

    switch ($command) {
${commandCases}
    }
}
`;
}
```

---

## 6. Dynamic Completion Helper (`src/cli/completions/dynamic.ts`)

For commands that need live data:

```typescript
// Called by shell completion scripts at completion time
// Must be fast (< 200ms) or it degrades shell UX

export async function getCompletionValues(type: string): Promise<string[]> {
  const client = getGatewayClient();
  try {
    switch (type) {
      case 'session-id':
        return (await client.getSessions({ limit: 50 })).map(s => s.id);
      case 'session-name':
        return (await client.getSessions({ limit: 50 })).map(s => s.name || s.id);
      case 'skill-name':
        return (await client.getSkills()).map(s => s.name);
      case 'model-id':
        return (await client.getModels()).map(m => m.id);
      case 'workspace-id':
        return (await client.getWorkspaces()).map(w => w.id);
      default:
        return [];
    }
  } catch {
    return []; // fail silently - do not break shell
  }
}
```

---

## 7. `carina completion` Command (`src/cli/commands/completion/index.ts`)

```typescript
export const command: Command = {
  name: 'completion',
  description: 'Generate shell completion scripts',
  usage: 'carina completion <shell>',
  args: [
    { name: 'shell', choices: ['bash', 'zsh', 'fish', 'powershell'], required: true },
  ],
  options: [
    { name: '--install', type: 'boolean', description: 'Install completion automatically' },
  ],
  async run(args, opts) {
    const { generateCompletions } = await import('../../completions/generate');
    const scripts = generateCompletions();
    const shell = args[0] as keyof typeof scripts;
    const script = scripts[shell];

    if (!script) {
      console.error(`Unknown shell: ${shell}. Choose from: bash, zsh, fish, powershell`);
      process.exit(1);
    }

    if (opts.install) {
      await installCompletion(shell, script);
    } else {
      console.log(script);
    }
  },
};

async function installCompletion(shell: string, script: string) {
  const os = await import('os');
  const fs = await import('fs/promises');
  const path = await import('path');

  const installPaths: Record<string, string> = {
    bash: path.join(os.homedir(), '.bash_completion.d', 'carina'),
    zsh: path.join(os.homedir(), '.zsh', 'completions', '_carina'),
    fish: path.join(os.homedir(), '.config', 'fish', 'completions', 'carina.fish'),
    powershell: path.join(os.homedir(), 'Documents', 'PowerShell', 'carina-completion.ps1'),
  };

  const installPath = installPaths[shell];
  await fs.mkdir(path.dirname(installPath), { recursive: true });
  await fs.writeFile(installPath, script, 'utf8');
  console.log(`Completion installed to: ${installPath}`);
  console.log(`Restart your shell or run: source ${installPath}`);
}
```

---

## Files to Create

```
core.carinaai.uk/src/cli/completions/
├── generate.ts         (orchestrator - generates all 4 scripts)
├── bash.ts             (bash _carina_complete function)
├── zsh.ts              (zsh #compdef _carina function)
├── fish.ts             (fish complete lines)
├── powershell.ts       (PowerShell Register-ArgumentCompleter block)
└── dynamic.ts          (live data fetcher for dynamic items)

core.carinaai.uk/src/cli/commands/completion/
└── index.ts            (carina completion <shell> [--install] command)
```

## Files to Modify

```
src/cli/registry.ts              → register 'completion' command
src/cli/completion-metadata.ts   → extend with all commands from 04 (already updated there)
```

---

## Testing

```bash
# Test each shell:
node -e "require('./dist/cli/completions/generate').generateCompletions()" | jq keys

# Bash:
source <(carina completion bash)
carina <TAB>              # shows top-level commands
carina session <TAB>      # shows session subcommands
carina session resume <TAB>  # shows session IDs (dynamic)

# Fish:
carina completion fish | source
# type: carina  then TAB

# Zsh:
eval "$(carina completion zsh)"
# type: carina  then TAB

# PowerShell:
carina completion powershell | Out-String | Invoke-Expression
# type: carina  then TAB
```

---

## Done When

- [ ] `carina completion bash` outputs a valid bash completion script
- [ ] `carina completion zsh` outputs a valid zsh completion script
- [ ] `carina completion fish` outputs valid fish completion lines
- [ ] `carina completion powershell` outputs a valid PS completion script
- [ ] `carina completion bash --install` writes to `~/.bash_completion.d/carina`
- [ ] After sourcing bash completion: `carina <TAB>` shows all top-level commands
- [ ] After sourcing bash completion: `carina session <TAB>` shows session subcommands
- [ ] After sourcing bash completion: `carina session resume <TAB>` shows live session IDs
- [ ] Dynamic completion fails silently (no errors in shell) if gateway is not running
