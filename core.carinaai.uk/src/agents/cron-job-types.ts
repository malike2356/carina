export interface CronScriptConfig {
  script: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CronJobYamlEntry {
  id?: string;
  name: string;
  schedule: string;
  prompt?: string;
  scriptConfig?: CronScriptConfig;
  script?: string;
  contextFrom?: string | string[];
  noAgent?: boolean;
  maxTokens?: number;
  modelOverride?: string;
  skills?: string[];
  workdir?: string;
  deliveryChannels?: string[];
  deliver_channels?: string[];
  failureLimit?: number;
  enabledToolsets?: string[];
  deliver?: string;
}

export function parseScriptConfig(raw: unknown): CronScriptConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.script !== 'string' || !obj.script.trim()) return null;
  return {
    script: obj.script,
    cwd: typeof obj.cwd === 'string' ? obj.cwd : undefined,
    timeoutMs: typeof obj.timeoutMs === 'number' ? obj.timeoutMs : undefined,
    env: obj.env && typeof obj.env === 'object'
      ? Object.fromEntries(
        Object.entries(obj.env as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k, String(v)]),
      )
      : undefined,
  };
}
