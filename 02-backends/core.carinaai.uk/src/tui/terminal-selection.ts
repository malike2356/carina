const DISABLE_MOUSE_REPORTING_SEQUENCE = [
  '\x1b[?9l',
  '\x1b[?1000l',
  '\x1b[?1002l',
  '\x1b[?1003l',
  '\x1b[?1005l',
  '\x1b[?1006l',
  '\x1b[?1015l',
].join('');

export interface SelectionFriendlyStream {
  isTTY?: boolean;
  write(chunk: string): unknown;
}

export function disableMouseReporting(stream: SelectionFriendlyStream = process.stdout): void {
  if (!stream.isTTY) return;
  stream.write(DISABLE_MOUSE_REPORTING_SEQUENCE);
}

export function withSelectionFriendlyUnmount(unmount: () => void): () => void {
  return () => {
    disableMouseReporting();
    unmount();
    disableMouseReporting();
  };
}
