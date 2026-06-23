import { recordSubagentMetric } from '../telemetry/subagent-metrics.js';

type CancelHandle = {
  sessionId: string;
  agentType: string;
  cancel: () => void;
};

const handles = new Map<string, CancelHandle>();

function key(sessionId: string, agentType: string): string {
  return `${sessionId}:${agentType}`;
}

export function registerSubagentCancel(
  sessionId: string,
  agentType: string,
  cancel: () => void,
): void {
  handles.set(key(sessionId, agentType), { sessionId, agentType, cancel });
}

export function unregisterSubagentCancel(sessionId: string, agentType: string): void {
  handles.delete(key(sessionId, agentType));
}

export function cancelSubagent(sessionId: string, agentType: string): boolean {
  const handle = handles.get(key(sessionId, agentType));
  if (!handle) return false;
  try {
    handle.cancel();
    recordSubagentMetric({ sessionId, agentType, status: 'cancelled' });
    return true;
  } finally {
    handles.delete(key(sessionId, agentType));
  }
}

export function _resetSubagentCancelRegistryForTests(): void {
  handles.clear();
}
