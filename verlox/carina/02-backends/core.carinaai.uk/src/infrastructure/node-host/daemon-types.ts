import type { NodeCommand, NodeHostLocalConfig } from './types.js';

export type NodeDaemonOptions = {
  config: NodeHostLocalConfig;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
  onCommand?: (cmd: NodeCommand) => Promise<void>;
  signal?: AbortSignal;
  containerMode?: boolean;
  transport?: 'poll' | 'ws' | 'auto';
};
