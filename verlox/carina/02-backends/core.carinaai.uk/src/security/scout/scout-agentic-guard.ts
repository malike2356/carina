import { isScoutMutualIntegrationActive } from '../scout-mode.js';

/** True when Carina should run Scout agentic intelligence (prompt 35). */
export function isScoutAgenticLayerEnabled(): boolean {
  return isScoutMutualIntegrationActive();
}
