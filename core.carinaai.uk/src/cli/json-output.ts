export type OutputMode = 'pretty' | 'json';

export function resolveOutputMode(args: string[]): OutputMode {
  return args.includes('--json') ? 'json' : 'pretty';
}

export function printCliOutput(data: unknown, mode: OutputMode = 'pretty'): void {
  if (mode === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (typeof data === 'string') {
    console.log(data);
    return;
  }
  console.log(String(data));
}

export function printCliTable(rows: Record<string, unknown>[], mode: OutputMode = 'pretty'): void {
  if (mode === 'json') {
    printCliOutput(rows, 'json');
    return;
  }
  for (const row of rows) {
    const line = Object.entries(row).map(([k, v]) => `${k}=${String(v)}`).join('  ');
    console.log(line);
  }
}
