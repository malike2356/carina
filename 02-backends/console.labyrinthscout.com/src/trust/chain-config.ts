export const TRUST_PLATFORM = 'agent-trust-on-base' as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

export const ERC8004_IDENTITY_REGISTRY: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_CHAIN_ID]: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  [BASE_MAINNET_CHAIN_ID]: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
};

export const ERC8004_VALIDATION_REGISTRY: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_CHAIN_ID]: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  [BASE_MAINNET_CHAIN_ID]: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
};

export const ERC8126_SPEC_URL = 'https://erc8126.ai/specification';

export const DEFAULT_TRUST_CHAIN_ID = BASE_SEPOLIA_CHAIN_ID;

export const DEFAULT_TRUST_RPC: Record<number, string> = {
  [BASE_SEPOLIA_CHAIN_ID]: 'https://sepolia.base.org',
  [BASE_MAINNET_CHAIN_ID]: 'https://mainnet.base.org',
};

export interface AgentTrustAddresses {
  interactionRegistry: `0x${string}`;
  attestationSchemaRegistry: `0x${string}`;
  trustGraph: `0x${string}`;
}

export const AGENT_TRUST_CONTRACTS: Record<number, AgentTrustAddresses> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    interactionRegistry: '0x12F5C3fD1893bf9b2DeaA43AE1A2CCb122C3E707',
    attestationSchemaRegistry: '0x64DaE82fE64D2fE96f90017FE51069C107BFe9d5',
    trustGraph: '0x8DC39B04A9C32e16DD7bd8906a8ea0d9DE6cCbDF',
  },
};

export const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export function explorerTxUrl(chainId: number, txHash: string): string {
  const base = chainId === BASE_MAINNET_CHAIN_ID
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org';
  return `${base}/tx/${txHash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  const base = chainId === BASE_MAINNET_CHAIN_ID
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org';
  return `${base}/address/${address}`;
}

export function agentRegistryCaip(agentId: string, chainId: number): string {
  const registry = ERC8004_IDENTITY_REGISTRY[chainId];
  return `eip155:${chainId}:${registry}#${agentId}`;
}
