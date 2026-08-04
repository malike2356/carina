import { GatewayClient } from '../ink/transport/json-rpc.js';
import type { TuiRuntimeTransport } from './types.js';

export function createJsonRpcTransport(baseUrl = 'local'): TuiRuntimeTransport {
  return new GatewayClient(baseUrl);
}
