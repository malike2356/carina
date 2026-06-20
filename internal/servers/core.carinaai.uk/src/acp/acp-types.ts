/** Agent Communication Protocol message types */
export type AcpMethod =
  | 'initialize'
  | 'session.create'
  | 'session.send'
  | 'session.abort'
  | 'session.close'
  | 'tools.list'
  | 'ping';

export interface AcpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: AcpMethod | string;
  params?: Record<string, unknown>;
}

export interface AcpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface AcpNotification {
  jsonrpc: '2.0';
  method: 'session.output' | 'session.complete' | 'session.error';
  params: Record<string, unknown>;
}

export interface AcpCapabilities {
  streaming: boolean;
  multiSession: boolean;
  tools: boolean;
  fileContext: boolean;
  cancelation: boolean;
}
