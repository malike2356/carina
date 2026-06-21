'use client';

import { Terminal } from './Terminal';

export function TerminalWorkspace({ raw = false }: { raw?: boolean } = {}) {
  return <Terminal mode={raw ? 'drawer' : 'page'} />;
}
