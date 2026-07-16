export type CockpitConnection = 'connecting' | 'online' | 'offline' | 'degraded' | 'error';
export type CockpitMode = 'chat' | 'model' | 'session' | 'agent' | 'scout' | 'help' | 'approval' | 'review' | 'debug';

export interface CockpitInput {
  sessionId?: string;
  sessionName?: string;
  model?: string;
  provider?: string;
  connection: CockpitConnection;
  streaming: boolean;
  queued: number;
  activeAgents: number;
  scoutTrust?: number;
  scoutLinked?: boolean;
  pendingApprovals: number;
  tokenCount: number;
  promptRefreshPending?: boolean;
  mode: CockpitMode;
}

export interface CockpitState {
  sessionLabel: string;
  modelLabel: string;
  connectionLabel: string;
  connectionTone: 'success' | 'warning' | 'error' | 'muted';
  streamLabel: string;
  queueLabel: string;
  agentsLabel: string;
  scoutLabel: string;
  approvalLabel: string;
  tokenLabel: string;
  modeLabel: string;
  hints: string[];
}

export function buildCockpitState(input: CockpitInput): CockpitState {
  const connection = mapConnection(input);
  return {
    sessionLabel: input.sessionName || input.sessionId?.slice(0, 8) || 'No session',
    modelLabel: formatModel(input.model, input.provider),
    connectionLabel: connection.label,
    connectionTone: connection.tone,
    streamLabel: input.streaming ? 'Streaming' : 'Idle',
    queueLabel: input.queued > 0 ? `Queue ${input.queued}` : 'Queue clear',
    agentsLabel: input.activeAgents > 0 ? `${input.activeAgents} agents` : 'No agents',
    scoutLabel: formatScout(input.scoutLinked, input.scoutTrust),
    approvalLabel: input.pendingApprovals > 0 ? `${input.pendingApprovals} approval` : 'No approvals',
    tokenLabel: `${input.tokenCount.toLocaleString()} tok`,
    modeLabel: formatMode(input.mode),
    hints: buildHints(input),
  };
}

export function cockpitLine(state: CockpitState, width: number): string {
  const parts = [
    state.connectionLabel,
    state.streamLabel,
    state.sessionLabel,
    state.modelLabel,
    state.scoutLabel,
    state.agentsLabel,
    state.approvalLabel,
    state.tokenLabel,
    state.modeLabel,
  ];
  let line = '';
  for (const part of parts) {
    const next = line ? `${line}  |  ${part}` : part;
    if (next.length > width) break;
    line = next;
  }
  return line || state.connectionLabel;
}

function mapConnection(input: CockpitInput): { label: string; tone: CockpitState['connectionTone'] } {
  if (input.connection === 'online' && input.streaming) return { label: 'Streaming', tone: 'success' };
  if (input.connection === 'online') return { label: 'Connected', tone: 'success' };
  if (input.connection === 'connecting') return { label: 'Connecting', tone: 'warning' };
  if (input.connection === 'degraded') return { label: 'Degraded', tone: 'warning' };
  if (input.connection === 'offline') return { label: 'Offline', tone: 'error' };
  return { label: 'Error', tone: 'error' };
}

function formatModel(model?: string, provider?: string): string {
  if (!model && !provider) return 'Model pending';
  if (provider && model && !model.includes(provider)) return `${provider}/${model}`;
  return model || provider || 'Model pending';
}

function formatScout(linked?: boolean, trust?: number): string {
  if (!linked) return 'Scout off';
  if (typeof trust === 'number') return `Scout ${trust}/100`;
  return 'Scout linked';
}

function formatMode(mode: CockpitMode): string {
  if (mode === 'chat') return 'Chat';
  if (mode === 'model') return 'Model picker';
  if (mode === 'session') return 'Sessions';
  if (mode === 'agent') return 'Agents';
  if (mode === 'scout') return 'Scout';
  if (mode === 'help') return 'Help';
  if (mode === 'approval') return 'Approval';
  if (mode === 'review') return 'Review';
  return 'Debug';
}

function buildHints(input: CockpitInput): string[] {
  if (input.pendingApprovals > 0) return ['Approve', 'Deny', 'Sudo'];
  if (input.streaming) return ['Esc stop', 'Ctrl+Shift+S Scout'];
  if (input.mode === 'model') return ['Enter select', 'Esc close'];
  if (input.mode === 'session') return ['Enter switch', 'Esc close'];
  return ['/', 'Ctrl+M model', 'Ctrl+S session', 'Ctrl+A agents', 'Ctrl+Shift+S Scout'];
}
