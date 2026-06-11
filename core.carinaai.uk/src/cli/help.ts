import type { CliCommand } from './types.js';

export function formatCommandHelp(cmd: CliCommand, indent = 2): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  const usage = cmd.usage ?? `carina ${cmd.name}`;
  lines.push(`${pad}${usage.padEnd(36)} ${cmd.summary}`);
  if (cmd.subcommands) {
    for (const sub of Object.values(cmd.subcommands)) {
      lines.push(...formatCommandHelp(sub, indent + 2));
    }
  }
  return lines;
}

export function buildHelpText(commands: CliCommand[], pkg: { name: string; version: string }): string {
  const lines = [
    `Carina v${pkg.version}`,
    '',
    'Usage:',
    '  carina [command] [options]',
    '',
    'Agent:',
    ...formatCommandHelp(commands.find((c) => c.name === 'chat')!),
    ...formatCommandHelp(commands.find((c) => c.name === 'tui')!),
    '',
    'Setup & config (model/tools open interactive menus when run bare in a TTY):',
    ...commands.filter((c) => ['setup', 'config', 'model', 'tools', 'profile', 'agents', 'personality', 'secrets', 'env'].includes(c.name))
      .flatMap((c) => formatCommandHelp(c)),
    '',
    'Gateway & channels:',
    ...commands.filter((c) => ['gateway', 'channels', 'whatsapp', 'pairing', 'web', 'serve', 'mcp'].includes(c.name))
      .flatMap((c) => formatCommandHelp(c)),
    '',
    'Memory & sessions:',
    ...commands.filter((c) => ['memory', 'sessions', 'checkpoint', 'rag', 'backup', 'curator', 'kanban'].includes(c.name))
      .flatMap((c) => formatCommandHelp(c)),
    '',
    'Skills & packs:',
    ...commands.filter((c) => ['skills', 'packs', 'ingest', 'hub', 'plugins', 'hooks'].includes(c.name))
      .flatMap((c) => formatCommandHelp(c)),
    '',
    'Cloud & security:',
    ...commands.filter((c) => ['scout', 'security', 'tenant', 'billing'].includes(c.name))
      .flatMap((c) => formatCommandHelp(c)),
    '',
    'Ops:',
    ...commands.filter((c) => ['host', 'commitments', 'ops', 'cron', 'doctor', 'logs', 'providers', 'contacts', 'migrate', 'update', 'ide', 'completion'].includes(c.name))
      .flatMap((c) => formatCommandHelp(c)),
    '',
    '  carina --version                    Print version',
    '  carina help [command]               Show help',
    '',
  ];
  return lines.join('\n');
}

export function buildCommandHelp(cmd: CliCommand, pkg: { version: string }): string {
  const lines = [
    `carina ${cmd.name} - ${cmd.summary}`,
    '',
    `Usage: ${cmd.usage ?? `carina ${cmd.name}`}`,
    '',
  ];
  if (cmd.subcommands) {
    lines.push('Subcommands:');
    for (const sub of Object.values(cmd.subcommands)) {
      lines.push(`  ${(sub.usage ?? sub.name).padEnd(32)} ${sub.summary}`);
    }
    lines.push('');
  }
  lines.push(`Carina v${pkg.version}`);
  return lines.join('\n');
}
