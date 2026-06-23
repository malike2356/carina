'use client';

import { useEffect, useState } from 'react';

type TerminalAccessState = {
  canUseTerminal: boolean;
  isOwner: boolean;
  terminalEnabled: boolean;
  loading: boolean;
};

const DEFAULT: TerminalAccessState = {
  canUseTerminal: false,
  isOwner: false,
  terminalEnabled: true,
  loading: true,
};

export function useTerminalAccess(): TerminalAccessState {
  const [state, setState] = useState<TerminalAccessState>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workspace/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data.data) return;
        setState({
          canUseTerminal: Boolean(data.data.canUseTerminal),
          isOwner: Boolean(data.data.isOwner),
          terminalEnabled: data.data.terminalEnabled !== false,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
