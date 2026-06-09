import { AgentTrustSDK } from '@open-agent-economy/trust-sdk';
import { config } from '../config/index.js';
import {
  AGENT_TRUST_CONTRACTS,
  DEFAULT_TRUST_CHAIN_ID,
} from './chain-config.js';

function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

export function createTrustSdk(chainId = config.trust.chainId ?? DEFAULT_TRUST_CHAIN_ID): AgentTrustSDK | null {
  const privateKey = config.trust.attesterPrivateKey;
  if (!privateKey) return null;

  const addresses = AGENT_TRUST_CONTRACTS[chainId];
  if (!addresses) return null;

  return new AgentTrustSDK({
    rpcUrl: config.trust.chainRpc,
    privateKey: normalizePrivateKey(privateKey),
    addresses: {
      interactionRegistry: addresses.interactionRegistry,
      attestationSchemaRegistry: addresses.attestationSchemaRegistry,
      trustGraph: addresses.trustGraph,
    },
  });
}
