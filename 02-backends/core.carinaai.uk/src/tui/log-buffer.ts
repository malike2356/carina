const MAX_LINES = 300;

const lines: string[] = [];

export function appendLog(line: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  lines.push(`[${stamp}] ${line}`);
  while (lines.length > MAX_LINES) lines.shift();
}

export function getLogLines(): string[] {
  return [...lines];
}

export function clearLogs(): void {
  lines.length = 0;
}

export function _resetLogBufferForTests(): void {
  lines.length = 0;
}
