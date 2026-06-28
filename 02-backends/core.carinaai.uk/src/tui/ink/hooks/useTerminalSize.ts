import { useEffect, useState } from 'react';
import { useStdout } from 'ink';
import { clampTerminalColumns, clampTerminalRows } from '../../responsive-frame.js';

export function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({
    columns: clampTerminalColumns(stdout?.columns ?? 80),
    rows: clampTerminalRows(stdout?.rows ?? 24),
  }));

  useEffect(() => {
    if (!stdout?.on) return undefined;

    const sync = () => {
      setSize({
        columns: clampTerminalColumns(stdout.columns ?? 80),
        rows: clampTerminalRows(stdout.rows ?? 24),
      });
    };

    sync();
    stdout.on('resize', sync);
    return () => {
      stdout.off('resize', sync);
    };
  }, [stdout]);

  return size;
}
