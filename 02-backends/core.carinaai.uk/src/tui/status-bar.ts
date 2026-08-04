import { truncate } from './terminal.js';
import { buildCockpitState, cockpitLine } from './command-center/cockpit.js';

export interface OperatorStatusState {
  sessionId: string;
  model: string;
  trustScore: number;
  tokenCount: number;
  activeAgents: number;
  thinkingLevel?: string;
  sidePanelLabel?: string;
  promptRefreshPending?: boolean;
}

export function renderOperatorStatusBar(state: OperatorStatusState, columns: number): string {
  const scoreColor = state.trustScore >= 90 ? '\x1b[32m'
    : state.trustScore >= 70 ? '\x1b[33m' : '\x1b[31m';

  const cockpit = buildCockpitState({
    sessionId: state.sessionId,
    model: state.model,
    connection: state.trustScore >= 70 ? 'online' : 'degraded',
    streaming: false,
    queued: 0,
    activeAgents: state.activeAgents,
    scoutLinked: true,
    scoutTrust: state.trustScore,
    pendingApprovals: 0,
    tokenCount: state.tokenCount,
    promptRefreshPending: state.promptRefreshPending,
    mode: state.sidePanelLabel ? 'debug' : 'chat',
  });

  const parts = [
    cockpitLine(cockpit, Math.max(20, columns - 48)),
    `${scoreColor}Trust: ${state.trustScore}\x1b[0m`,
    state.thinkingLevel ? `Think: ${state.thinkingLevel}` : '',
    state.activeAgents > 0 ? `\x1b[35mAgents: ${state.activeAgents}\x1b[0m` : '',
    state.promptRefreshPending ? '\x1b[33mPrompt refresh pending\x1b[0m' : '',
    state.sidePanelLabel ? `Panel: ${state.sidePanelLabel}` : '',
    '[F1-F4] Panels  [F5] Close  [F6] Security  [F10] Quit',
  ].filter(Boolean);

  return `\x1b[90m${truncate(parts.join('  |  '), columns)}\x1b[0m`;
}

export function sidePanelLabel(type: string): string | undefined {
  switch (type) {
    case 'scout': return 'Scout';
    case 'memory': return 'Memory';
    case 'skills': return 'Skills';
    case 'logs': return 'Logs';
    case 'security': return 'Security';
    default: return undefined;
  }
}
