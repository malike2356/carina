import { config } from '../config/index.js';

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

export type ScoutClientModule = {
  reportEvent: (event: ScoutEvent) => Promise<void>;
  reportToolCall: (call: ToolCallReport) => Promise<void>;
  reportHeartbeat: () => Promise<void>;
  recordToolCall: (sessionId: string, toolName: string, responseLength: number) => Promise<void>;
  flushMetricsToScout: (instanceId: string, sessionId: string) => Promise<void>;
  stopMetricsFlush: (sessionId: string) => void;
  sanitiseParams: (params: Record<string, unknown>) => Record<string, unknown>;
  _resetMetricsTimers: () => void;
  _resetScoutWarnFlag: () => void;
};

export const SCOUT_INSTALL_HINT =
  'Scout client not installed. Run: npm install @verlox/carina-scout';

export function scoutIntegrationRequested(): boolean {
  if (process.env.LABYRINTH_ENABLED === 'true' || process.env.SCOUT_ENABLED === 'true') {
    return true;
  }
  return config.labyrinth.enabled
    && config.labyrinth.url !== ''
    && Boolean(config.labyrinth.apiKey);
}

let cached: ScoutClientModule | null | undefined;
let warnedMissing = false;

export async function importScoutPackage(): Promise<ScoutClientModule | null> {
  if (cached !== undefined) return cached;
  if (!scoutIntegrationRequested()) {
    cached = null;
    return null;
  }
  try {
    cached = await import('@verlox/carina-scout') as ScoutClientModule;
    return cached;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND') {
      if (!warnedMissing) {
        console.warn(SCOUT_INSTALL_HINT);
        warnedMissing = true;
      }
      cached = null;
      return null;
    }
    throw err;
  }
}

/** Reset loader cache (tests only). */
export function _resetScoutPackageCache(): void {
  cached = undefined;
  warnedMissing = false;
}

export function scoutInstallHint(): string {
  return SCOUT_INSTALL_HINT;
}
