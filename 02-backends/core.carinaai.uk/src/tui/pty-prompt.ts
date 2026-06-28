import readline from 'node:readline/promises';

let rl: readline.Interface | null = null;

export function isOpsPtyMode(): boolean {
  return process.env.CARINA_OPS_PTY === '1';
}

function getInterface(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

export async function promptLine(label: string): Promise<string> {
  return getInterface().question(label);
}

export async function closePtyPromptInterface(): Promise<void> {
  if (rl) {
    await rl.close();
    rl = null;
  }
}
