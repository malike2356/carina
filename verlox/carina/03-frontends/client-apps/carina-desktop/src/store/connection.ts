import { atom } from 'nanostores';
import { getHealth, type HealthStatus } from '../lib/gateway-client.js';

export const $gatewayStatus = atom<HealthStatus['status']>('down');
export const $gatewayVersion = atom<string | undefined>(undefined);

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthPolling(intervalMs = 5000): void {
  if (pollInterval) return;
  void checkHealth();
  pollInterval = setInterval(() => void checkHealth(), intervalMs);
}

export function stopHealthPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function checkHealth(): Promise<void> {
  const result = await getHealth();
  $gatewayStatus.set(result.status);
  if (result.version) $gatewayVersion.set(result.version);
}
