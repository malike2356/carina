import { atom } from 'nanostores';
import { getHealth } from '../lib/gateway-client.js';
export const $gatewayStatus = atom('down');
export const $gatewayVersion = atom(undefined);
let pollInterval = null;
export function startHealthPolling(intervalMs = 5000) {
    if (pollInterval)
        return;
    void checkHealth();
    pollInterval = setInterval(() => void checkHealth(), intervalMs);
}
export function stopHealthPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}
async function checkHealth() {
    const result = await getHealth();
    $gatewayStatus.set(result.status);
    if (result.version)
        $gatewayVersion.set(result.version);
}
