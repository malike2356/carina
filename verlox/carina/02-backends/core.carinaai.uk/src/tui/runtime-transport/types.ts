import type { ModelInfo, SessionInfo } from '../ink/transport/json-rpc.js';

export type TuiRuntimeTransportMode = 'json-rpc' | 'in-process' | 'mock';

export interface RuntimeEvent {
  type: 'health' | 'session' | 'stream' | 'approval' | 'interrupt' | 'usage' | 'tool';
  at: string;
  sessionId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeSnapshot {
  mode: TuiRuntimeTransportMode;
  healthy: boolean;
  activeSessionId?: string;
  activeModel?: string;
  queuedEvents: number;
}

export interface StreamChatHandlers {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface RuntimeToolSummary {
  name: string;
  description?: string;
  risk?: 'safe' | 'confirm' | 'danger';
}

export interface RuntimeUsageSummary {
  tokens: number;
  costUsd?: number;
}

export interface TuiRuntimeTransport {
  readonly mode: TuiRuntimeTransportMode;
  healthCheck: () => Promise<boolean>;
  createSession: () => Promise<SessionInfo>;
  listSessions: () => Promise<SessionInfo[]>;
  switchSession: (sessionId: string) => Promise<SessionInfo | undefined>;
  streamChat: (sessionId: string, message: string, handlers: StreamChatHandlers) => Promise<void>;
  interrupt: (sessionId: string) => Promise<void>;
  sendSteer: (sessionId: string, message: string) => Promise<void>;
  getRuntimeSnapshot: () => Promise<RuntimeSnapshot>;
  subscribeRuntimeEvents: (listener: (event: RuntimeEvent) => void) => () => void;
  resolveApproval: (approvalId: string, approved: boolean) => Promise<void>;
  listTools: () => Promise<RuntimeToolSummary[]>;
  getUsage: (sessionId?: string) => Promise<RuntimeUsageSummary>;
  listModels: () => Promise<ModelInfo[]>;
  switchProvider: (provider: string, model?: string) => Promise<void>;
  call: <T>(method: string, params?: unknown) => Promise<T>;
}

export type { ModelInfo, SessionInfo };
