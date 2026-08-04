import chalk from 'chalk';

export const format = {
  title: (value: string): string => chalk.bold.white(value),
  muted: (value: string): string => chalk.gray(value),
  info: (value: string): string => chalk.cyan(value),
  success: (value: string): string => chalk.green(value),
  warning: (value: string): string => chalk.yellow(value),
  error: (value: string): string => chalk.red(value),
};

export function printTable(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0] ?? {});
  const widths = headers.map((header) =>
    Math.max(header.length, ...rows.map((row) => String(row[header] ?? '').length)),
  );

  console.log(headers.map((header, i) => header.padEnd(widths[i] ?? header.length)).join('  '));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    console.log(headers.map((header, i) => String(row[header] ?? '').padEnd(widths[i] ?? 0)).join('  '));
  }
}

export function renderToken(token: string): void {
  process.stdout.write(token);
}
