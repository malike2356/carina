import type { ChannelMessage } from './channel-adapter.interface.js';
import { buildSessionExternalKey } from './channel-routing.js';
import { buildSurfaceSessionMapKey, operatorSessionEnabled } from '../../surfaces/index.js';
import { getIdentityResolver, identityLinksEnabled } from '../identity-resolver.js';
import { buildLinkedSessionExternalKey } from '../session-identity-prefs.js';

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

export async function buildGatewaySessionMapKeyAsync(
  agentId: string,
  inbound: ChannelMessage,
): Promise<string> {
  if (operatorSessionEnabled()) {
    return buildSurfaceSessionMapKey(agentId, 'operator', 'unified');
  }
  const legacyKey = buildSessionExternalKey(inbound);
  if (!identityLinksEnabled()) {
    return buildSurfaceSessionMapKey(agentId, inbound.channel, legacyKey);
  }
  const canonicalUserId = await getIdentityResolver().resolve(
    inbound.channel,
    inbound.externalUserId,
    inbound.senderName,
  );
  const linkedKey = await buildLinkedSessionExternalKey(
    canonicalUserId,
    inbound.channel,
    legacyKey,
  );
  const shared = linkedKey.startsWith('canonical:');
  return buildSurfaceSessionMapKey(
    agentId,
    shared ? 'linked' : inbound.channel,
    linkedKey,
  );
}

export function describeSessionBinding(inbound: ChannelMessage): string {
  if (operatorSessionEnabled()) {
    return 'unified operator session across platforms';
  }
  return `scoped to ${inbound.channel}:${buildSessionExternalKey(inbound)}`;
}
