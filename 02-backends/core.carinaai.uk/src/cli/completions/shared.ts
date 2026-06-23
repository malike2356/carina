import {
  NESTED_OPTIONS,
  SUBCOMMANDS,
  TOP_LEVEL_COMMANDS,
} from '../completion-metadata.js';

export type CompletionShell = 'bash' | 'zsh' | 'fish' | 'powershell';

export const COMPLETION_SHELLS: CompletionShell[] = ['bash', 'zsh', 'fish', 'powershell'];

export const COMMON_FLAGS = ['--json', '--help', '-h', '--version', '-v', '--install'];

export function bashWords(values: readonly string[]): string {
  return values.join(' ');
}

export function escapePsSingle(value: string): string {
  return value.replace(/'/g, "''");
}

export function getTopLevelCommands(): readonly string[] {
  return TOP_LEVEL_COMMANDS;
}

export function getSubcommands(): Record<string, readonly string[]> {
  return SUBCOMMANDS;
}

export function getNestedOptions(): Record<string, Record<string, readonly string[]>> {
  return NESTED_OPTIONS;
}

export function humanizeToken(token: string): string {
  return token.replace(/-/g, ' ');
}
