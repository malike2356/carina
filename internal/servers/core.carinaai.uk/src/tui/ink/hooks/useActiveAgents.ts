import { useSyncExternalStore, useEffect } from 'react';
import {
  subscribeAgents,
  getActiveAgents,
  startAgentPolling,
  stopAgentPolling,
} from '../store/agents.js';
import type { ActiveAgent } from '../store/agents.js';

export function useActiveAgents(enabled = true): ActiveAgent[] {
  useEffect(() => {
    if (!enabled) {
      stopAgentPolling();
      return undefined;
    }
    startAgentPolling(1000);
    return () => stopAgentPolling();
  }, [enabled]);

  return useSyncExternalStore(subscribeAgents, getActiveAgents, () => []);
}
