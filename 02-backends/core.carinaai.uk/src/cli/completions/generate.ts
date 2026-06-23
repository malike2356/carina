import { generateBash } from './bash.js';
import { generateFish } from './fish.js';
import { generatePowerShell } from './powershell.js';
import type { CompletionShell } from './shared.js';
import { generateZsh } from './zsh.js';

export interface CompletionScript {
  bash: string;
  zsh: string;
  fish: string;
  powershell: string;
}

export function generateCompletions(): CompletionScript {
  return {
    bash: generateBash(),
    zsh: generateZsh(),
    fish: generateFish(),
    powershell: generatePowerShell(),
  };
}

export function generateCompletionForShell(shell: CompletionShell): string {
  const scripts = generateCompletions();
  return scripts[shell];
}
