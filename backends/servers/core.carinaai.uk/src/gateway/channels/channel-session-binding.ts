import type { ChannelMessage } from './channel-adapter.interface.js';
import { buildSessionExternalKey } from './channel-routing.js';
import { buildSurfaceSessionMapKey, operatorSessionEnabled } from '../../surfaces/index.js';

export { operatorSessionEnabled };

/**
 * Redis/memory map key for gateway session allocation.
 * Operator mode shares one session across all platforms for the same agent.
 */
export function buildGatewaySessionMapKey(agentId: string, inbound: ChannelMessage): string {
  if (operatorSessionEnabled()) {
    return buildSurfaceSessionMapKey(agentId, 'operator', 'unified');
  }
  const externalKey = buildSessionExternalKey(inbound);
  return buildSurfaceSessionMapKey(agentId, inbound.channel, externalKey);
}

export function describeSessionBinding(inbound: ChannelMessage): string {
  if (operatorSessionEnabled()) {
    return 'unified operator session across platforms';
  }
  return `scoped to ${inbound.channel}:${buildSessionExternalKey(inbound)}`;
}
