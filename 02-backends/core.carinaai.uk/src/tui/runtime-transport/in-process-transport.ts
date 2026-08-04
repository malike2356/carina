import { GatewayClient } from '../ink/transport/json-rpc.js';
import type { TuiRuntimeTransport } from './types.js';

export function createInProcessTransport(): TuiRuntimeTransport {
  return new GatewayClient('in-process');
}
