import type { SecurityDashboardData } from './types.js';
import { buildSecurityDashboardData } from './aggregator.js';

type DashboardListener = (data: SecurityDashboardData) => void;

const listeners = new Set<DashboardListener>();
let lastPayload: SecurityDashboardData | null = null;

export function getLastDashboardPayload(): SecurityDashboardData | null {
  return lastPayload;
}

export function subscribeDashboardStream(listener: DashboardListener): () => void {
  listeners.add(listener);
  if (lastPayload) listener(lastPayload);
  return () => listeners.delete(listener);
}

export async function publishDashboardUpdate(data?: SecurityDashboardData): Promise<SecurityDashboardData> {
  const payload = data ?? await buildSecurityDashboardData();
  lastPayload = payload;
  for (const listener of listeners) {
    listener(payload);
  }
  return payload;
}

export function formatDashboardSseEvent(data: SecurityDashboardData): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
