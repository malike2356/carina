import { escapePsSingle, getSubcommands, getTopLevelCommands, humanizeToken } from './shared.js';

export function generatePowerShell(): string {
  const topLevel = getTopLevelCommands();
  const subcommands = getSubcommands();

  const topLevelResults = topLevel.map((name) =>
    `            [CompletionResult]::new('${escapePsSingle(name)}', '${escapePsSingle(name)}', [CompletionResultType]::ParameterValue, '${escapePsSingle(humanizeToken(name))}')`,
  ).join(",\n");

  const commandCases = Object.entries(subcommands).map(([group, subs]) => {
    const subItems = subs.map((sub) =>
      `                    [CompletionResult]::new('${escapePsSingle(sub)}', '${escapePsSingle(sub)}', [CompletionResultType]::ParameterValue, '${escapePsSingle(humanizeToken(sub))}')`,
    ).join(",\n");
    const aliases: Record<string, string[]> = {
      workspace: ['ws'],
      session: ['s'],
      memory: ['mem'],
      model: ['m'],
      task: ['t'],
      skill: ['sk'],
      agent: ['a'],
      webhook: ['wh'],
      scout: ['sec'],
      channel: ['ch'],
      config: ['cfg'],
    };
    const patterns = [group, ...(aliases[group] ?? [])].map((p) => `'${escapePsSingle(p)}'`).join('|');
    return `        { $_ -in @(${patterns}) } {
${subItems}
                }`;
  }).join("\n");

  return `# Carina PowerShell completion
# Add to your profile: carina completion powershell | Out-String | Invoke-Expression

Register-ArgumentCompleter -Native -CommandName carina -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $words = @($commandAst.CommandElements | ForEach-Object { $_.Value })
    $command = if ($words.Count -gt 1) { $words[1] } else { '' }

    if ($words.Count -le 2) {
        @(
${topLevelResults}
        ) | Where-Object { $_.CompletionText -like "$wordToComplete*" }
        return
    }

    switch -Wildcard ($command) {
${commandCases}
    }

    switch ($words[-2]) {
        { $_ -in @('--session', '-s') } {
            @(carina completion dynamic session-id 2>$null) | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, 'session id')
            } | Where-Object { $_.CompletionText -like "$wordToComplete*" }
        }
        '--skill' {
            @(carina completion dynamic skill-name 2>$null) | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, 'skill name')
            } | Where-Object { $_.CompletionText -like "$wordToComplete*" }
        }
        '--model' {
            @(carina completion dynamic model-id 2>$null) | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, 'model id')
            } | Where-Object { $_.CompletionText -like "$wordToComplete*" }
        }
        '--workspace' {
            @(carina completion dynamic workspace-id 2>$null) | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, 'workspace id')
            } | Where-Object { $_.CompletionText -like "$wordToComplete*" }
        }
        { $_ -in @('resume', 'delete', 'rename', 'export', 'share', 'stats', 'show') } {
            if ($command -in @('session', 's', 'sessions')) {
                @(carina completion dynamic session-id 2>$null) | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, 'session id')
                } | Where-Object { $_.CompletionText -like "$wordToComplete*" }
            }
        }
    }
}
`;
}
