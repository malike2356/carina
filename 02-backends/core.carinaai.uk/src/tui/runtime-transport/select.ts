import { createInProcessTransport } from './in-process-transport.js';
import { createJsonRpcTransport } from './json-rpc-transport.js';
import { createMockTransport } from './mock-transport.js';
import type { TuiRuntimeTransport, TuiRuntimeTransportMode } from './types.js';

export interface SelectTuiRuntimeTransportOptions {
  gatewayUrl?: string;
  mode?: TuiRuntimeTransportMode;
}

export function selectTuiRuntimeTransport(options: SelectTuiRuntimeTransportOptions = {}): TuiRuntimeTransport {
  const mode = options.mode ?? resolveTransportMode(options.gatewayUrl);
  if (mode === 'mock') return createMockTransport();
  if (mode === 'in-process') return createInProcessTransport();
  return createJsonRpcTransport(options.gatewayUrl ?? 'local');
}

export function resolveTransportMode(gatewayUrl?: string): TuiRuntimeTransportMode {
  const envMode = process.env.CARINA_TUI_TRANSPORT?.trim().toLowerCase();
  if (envMode === 'in-process' || envMode === 'mock' || envMode === 'json-rpc') return envMode;
  if (gatewayUrl === 'in-process') return 'in-process';
  return 'json-rpc';
}
