declare module '@verlox/carina-web' {
  import type { Express } from 'express';

  export type StartWebOptions = {
    localMode?: boolean;
    host?: string;
    port?: number;
  };

  export type WebGatewayOptions = StartWebOptions;

  export function startWeb(options?: StartWebOptions): Promise<void>;
  export function createWebServer(options?: StartWebOptions): Promise<Express>;
  export const WEB_ASSET_DIR: string;
  export const DASHBOARD_ASSET_DIR: string;
}

declare module '@verlox/carina-scout' {
  export type ScoutEvent = {
    severity: 'info' | 'warning' | 'critical' | 'breach';
    source: string;
    event_type: string;
    description: string;
    metadata?: Record<string, unknown>;
    session_id?: string;
    instance_id?: string;
  };

  export type ToolCallReport = {
    toolName: string;
    params: Record<string, unknown>;
    resultSummary: string;
    durationMs: number;
    sessionId?: string;
    success: boolean;
    errorMessage?: string;
  };

  export function reportEvent(event: ScoutEvent): Promise<void>;
  export function reportToolCall(call: ToolCallReport): Promise<void>;
  export function reportHeartbeat(): Promise<void>;
  export function recordToolCall(
    sessionId: string,
    toolName: string,
    responseLength: number,
  ): Promise<void>;
  export function flushMetricsToScout(instanceId: string, sessionId: string): Promise<void>;
  export function stopMetricsFlush(sessionId: string): void;
  export function sanitiseParams(params: Record<string, unknown>): Record<string, unknown>;
  export function _resetMetricsTimers(): void;
  export function _resetScoutWarnFlag(): void;
  export const SCOUT_INSTALL_HINT: string;
}

declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
  }
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

declare module 'mammoth' {
  export function extractRawText(input: {
    buffer: Buffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
