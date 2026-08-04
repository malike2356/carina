'use client';

import dynamic from 'next/dynamic';

const Terminal = dynamic(
  () => import('./Terminal').then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center text-sm text-text-secondary">
        Loading terminal...
      </div>
    ),
  },
);

export function TerminalWorkspace({ raw = false }: { raw?: boolean } = {}) {
  return <Terminal mode={raw ? 'drawer' : 'page'} />;
}
