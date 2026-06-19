import readline from 'node:readline/promises';
import {
  classifyCommand,
  commandFlaggingEnabled,
  criticalOverrideEnabled,
  type CommandFlag,
} from './command-flag.js';
import { formatCommandFlag } from './command-flag-presenter.js';
import { appendFlagAudit } from './command-flag-audit.js';

export class FlaggedCriticalError extends Error {
  readonly code = 'COMMAND_FLAG_CRITICAL';

  constructor(public readonly flag: CommandFlag) {
    super(`Command blocked by safety flag: ${flag.whatItDoes}`);
    this.name = 'FlaggedCriticalError';
  }
}

export type CommandFlagEnforceResult =
  | { allowed: true; flag: CommandFlag | null }
  | { allowed: false; flag: CommandFlag; reason: string; code: string };

type EnforceOptions = {
  output?: (text: string) => void;
  prompt?: (question: string) => Promise<string>;
};

function defaultOutput(text: string): void {
  console.log(text);
}

async function defaultPrompt(question: string): Promise<string> {
  if (!process.stdin.isTTY) return '';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function promptDangerApproval(
  flag: CommandFlag,
  options: EnforceOptions,
): Promise<boolean> {
  const prompt = options.prompt ?? defaultPrompt;
  const answer = await prompt('\n  Run? [y/N] ');
  return answer.toLowerCase() === 'y';
}

export async function enforceCommandFlag(
  command: string,
  sessionId: string,
  options: EnforceOptions = {},
): Promise<CommandFlagEnforceResult> {
  if (!commandFlaggingEnabled()) {
    return { allowed: true, flag: null };
  }

  const flag = classifyCommand(command);
  if (flag.level === 'safe') {
    return { allowed: true, flag: null };
  }

  const output = options.output ?? defaultOutput;
  output(`\n${formatCommandFlag(flag)}`);

  if (flag.level === 'critical') {
    if (criticalOverrideEnabled()) {
      appendFlagAudit(flag, 'approved', sessionId);
      return { allowed: true, flag };
    }
    appendFlagAudit(flag, 'declined', sessionId);
    return {
      allowed: false,
      flag,
      reason: flag.whatItDoes,
      code: 'COMMAND_FLAG_CRITICAL',
    };
  }

  if (flag.level === 'danger') {
    if (!process.stdin.isTTY) {
      appendFlagAudit(flag, 'auto-declined', sessionId);
      return {
        allowed: false,
        flag,
        reason: 'Flagged shell command declined in non-interactive mode.',
        code: 'COMMAND_FLAG_DECLINED',
      };
    }
    const approved = await promptDangerApproval(flag, options);
    if (!approved) {
      appendFlagAudit(flag, 'declined', sessionId);
      return {
        allowed: false,
        flag,
        reason: 'User declined flagged shell command.',
        code: 'COMMAND_FLAG_DECLINED',
      };
    }
    appendFlagAudit(flag, 'approved', sessionId);
    return { allowed: true, flag };
  }

  appendFlagAudit(flag, 'auto', sessionId);
  return { allowed: true, flag };
}
