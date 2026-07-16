// Agent integrity + comms monitoring
import { loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';

/** In-memory registry of known agent identities (populated by ingest hooks). */
const knownAgents = new Map<string, { signature?: string; lastSeen: string }>();

export function registerAgentIdentity(agentId: string, signature?: string): void {
  knownAgents.set(agentId, { signature, lastSeen: new Date().toISOString() });
}

export async function runDeployedAgentsSensor(
  observed: Array<{ agentId: string; signature?: string }> = [],
): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.deployed_agents) return [];
  const out: SensorSignal[] = [];

  for (const agent of observed) {
    const known = knownAgents.get(agent.agentId);
    if (!known) {
      out.push(signal(
        'deployed_agents',
        'Unknown deployed agent',
        `Agent ${agent.agentId} not in known identity registry`,
        7,
        0.7,
        { evidence: { agentId: agent.agentId } },
      ));
      continue;
    }
    if (known.signature && agent.signature && known.signature !== agent.signature) {
      out.push(signal(
        'deployed_agents',
        'Agent impersonation suspected',
        `Signature mismatch for agent ${agent.agentId}`,
        9,
        0.9,
        { evidence: { agentId: agent.agentId } },
      ));
    }
    knownAgents.set(agent.agentId, {
      signature: agent.signature ?? known.signature,
      lastSeen: new Date().toISOString(),
    });
  }

  return out;
}
