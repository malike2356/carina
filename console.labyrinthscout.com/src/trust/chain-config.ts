export const TRUST_PLATFORM = 'agent-trust-on-base' as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

export const ERC8004_IDENTITY_REGISTRY: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_CHAIN_ID]: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  [BASE_MAINNET_CHAIN_ID]: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
};

export const DEFAULT_TRUST_CHAIN_ID = BASE_SEPOLIA_CHAIN_ID;

export const DEFAULT_TRUST_RPC: Record<number, string> = {
  [BASE_SEPOLIA_CHAIN_ID]: 'https://sepolia.base.org',
  [BASE_MAINNET_CHAIN_ID]: 'https://mainnet.base.org',
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
