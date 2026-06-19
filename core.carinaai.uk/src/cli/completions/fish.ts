import { getNestedOptions, getSubcommands, getTopLevelCommands, humanizeToken } from './shared.js';

export function generateFish(): string {
  const lines: string[] = [
    '# Carina fish completion',
    '# Run: carina completion fish | source',
    '',
    'complete -c carina -f',
    `complete -c carina -n '__fish_use_subcommand' -a '${getTopLevelCommands().join(' ')}'`,
  ];

  for (const [cmd, subs] of Object.entries(getSubcommands())) {
    lines.push(`complete -c carina -n '__fish_seen_subcommand_from ${cmd}' -a '${subs.join(' ')}'`);
    const nested = getNestedOptions()[cmd];
    if (!nested) continue;
    for (const [sub, opts] of Object.entries(nested)) {
      if (opts.length === 0) continue;
      lines.push(
        `complete -c carina -n '__fish_seen_subcommand_from ${cmd}; and __fish_seen_subcommand_from ${sub}' -a '${opts.join(' ')}'`,
      );
    }
  }

  lines.push('');
  lines.push('complete -c carina -l json -d "Output as JSON"');
  lines.push('complete -c carina -l help -s h -d "Show help"');
  lines.push('complete -c carina -l install -d "Install completion script"');
  lines.push(`complete -c carina -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish powershell dynamic'`);

  for (const type of ['session-id', 'session-name', 'skill-name', 'model-id', 'workspace-id']) {
    lines.push(
      `complete -c carina -n '__fish_seen_subcommand_from completion; and __fish_seen_subcommand_from dynamic' -a '${type}' -d '${humanizeToken(type)}'`,
    );
  }

  lines.push('');
  lines.push('# Dynamic: session IDs');
  lines.push(
    'complete -c carina -f -n \'__fish_seen_subcommand_from session; and __fish_seen_subcommand_from resume delete rename export share stats show\' -a "(carina completion dynamic session-id 2>/dev/null)"',
  );
  lines.push(
    'complete -c carina -f -n \'__fish_seen_subcommand_from s; and __fish_seen_subcommand_from resume delete rename export share stats\' -a "(carina completion dynamic session-id 2>/dev/null)"',
  );
  lines.push('# Dynamic: skill names');
  lines.push(
    'complete -c carina -f -n \'__fish_seen_subcommand_from skill; and __fish_seen_subcommand_from install uninstall enable disable info\' -a "(carina completion dynamic skill-name 2>/dev/null)"',
  );
  lines.push('# Dynamic: model providers');
  lines.push(
    'complete -c carina -f -n \'__fish_seen_subcommand_from model; and __fish_seen_subcommand_from use set test\' -a "(carina completion dynamic model-id 2>/dev/null)"',
  );
  lines.push('# Dynamic: workspace IDs');
  lines.push(
    'complete -c carina -f -n \'__fish_seen_subcommand_from workspace; and __fish_seen_subcommand_from switch rename delete\' -a "(carina completion dynamic workspace-id 2>/dev/null)"',
  );

  return `${lines.join('\n')}\n`;
}
