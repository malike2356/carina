import type { CronJobYamlEntry } from './cron-job-types.js';
import { parseScriptConfig } from './cron-job-types.js';

export function parseCronYamlEntry(raw: Record<string, unknown>): CronJobYamlEntry {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    name: String(raw.name ?? raw.id ?? 'unnamed-job'),
    schedule: String(raw.schedule ?? ''),
    prompt: raw.prompt != null ? String(raw.prompt) : undefined,
    scriptConfig: parseScriptConfig(raw.scriptConfig) ?? undefined,
    script: raw.script != null ? String(raw.script) : undefined,
    contextFrom: raw.contextFrom as string | string[] | undefined,
    noAgent: raw.noAgent != null ? Boolean(raw.noAgent) : undefined,
    workdir: raw.workdir != null ? String(raw.workdir) : undefined,
    deliveryChannels: Array.isArray(raw.deliveryChannels)
      ? raw.deliveryChannels.map(String)
      : undefined,
    deliver_channels: Array.isArray(raw.deliver_channels)
      ? raw.deliver_channels.map(String)
      : undefined,
    failureLimit: raw.failureLimit != null ? Number(raw.failureLimit) : undefined,
    enabledToolsets: Array.isArray(raw.enabledToolsets)
      ? raw.enabledToolsets.map(String)
      : undefined,
    deliver: raw.deliver != null ? String(raw.deliver) : undefined,
  };
}
