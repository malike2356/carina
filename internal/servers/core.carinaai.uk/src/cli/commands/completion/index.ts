import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { generateCompletionForShell, generateCompletions } from '../../completions/generate.js';
import {
  DYNAMIC_COMPLETION_TYPES,
  isDynamicCompletionType,
  printDynamicCompletionValues,
} from '../../completions/dynamic.js';
import type { CompletionShell } from '../../completions/shared.js';
import { COMPLETION_SHELLS } from '../../completions/shared.js';

const INSTALL_PATHS: Record<CompletionShell, (home: string) => string> = {
  bash: (home) => path.join(home, '.bash_completion.d', 'carina'),
  zsh: (home) => path.join(home, '.zsh', 'completions', '_carina'),
  fish: (home) => path.join(home, '.config', 'fish', 'completions', 'carina.fish'),
  powershell: (home) => path.join(home, 'Documents', 'PowerShell', 'carina-completion.ps1'),
};

function parseArgs(args: string[]): { shell?: string; install: boolean; rest: string[] } {
  const install = args.includes('--install');
  const rest = args.filter((a) => a !== '--install');
  return { shell: rest[0], install, rest: rest.slice(1) };
}

async function installCompletion(shell: CompletionShell, script: string): Promise<void> {
  const home = os.homedir();
  const installPath = INSTALL_PATHS[shell](home);
  await fs.mkdir(path.dirname(installPath), { recursive: true });
  await fs.writeFile(installPath, script, 'utf8');
  console.log(`Completion installed to: ${installPath}`);
  if (shell === 'bash') {
    console.log(`Restart your shell or run: source ${installPath}`);
  } else if (shell === 'zsh') {
    console.log(`Restart your shell or ensure fpath includes ${path.dirname(installPath)}`);
  } else if (shell === 'fish') {
    console.log('Restart fish to load the new completion file.');
  } else {
    console.log(`Add to your profile: . ${installPath}`);
  }
}

export function buildBashCompletionScript(): string {
  return generateCompletionForShell('bash');
}

export function buildZshCompletionScript(): string {
  return generateCompletionForShell('zsh');
}

export function buildFishCompletionScript(): string {
  return generateCompletionForShell('fish');
}

export function buildPowerShellCompletionScript(): string {
  return generateCompletionForShell('powershell');
}

export async function runCompletionCommand(args: string[]): Promise<void> {
  const { shell, install, rest } = parseArgs(args);

  if (!shell) {
    console.error(`Usage: carina completion <${COMPLETION_SHELLS.join('|')}|dynamic> [--install]`);
    process.exit(1);
  }

  if (shell === 'dynamic') {
    const type = rest[0];
    if (!type || !isDynamicCompletionType(type)) {
      console.error(`Usage: carina completion dynamic <${DYNAMIC_COMPLETION_TYPES.join('|')}>`);
      process.exit(1);
    }
    await printDynamicCompletionValues(type);
    return;
  }

  if (!COMPLETION_SHELLS.includes(shell as CompletionShell)) {
    console.error(`Unknown shell: ${shell}. Choose from: ${COMPLETION_SHELLS.join(', ')}`);
    process.exit(1);
  }

  const script = generateCompletionForShell(shell as CompletionShell);
  if (install) {
    await installCompletion(shell as CompletionShell, script);
    return;
  }

  console.log(script);
}

export { generateCompletions };
