import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  toBytes,
  type Address,
  type Chain,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { config } from '../../config/index.js';
import {
  DEFAULT_TRUST_CHAIN_ID,
  ERC8004_VALIDATION_REGISTRY,
} from '../chain-config.js';
import { ERC8126_VERIFICATION_TAG } from './verification-types.js';

export const VALIDATION_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'validationRequest',
    inputs: [
      { name: 'validatorAddress', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'requestURI', type: 'string' },
      { name: 'requestHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validationResponse',
    inputs: [
      { name: 'requestHash', type: 'bytes32' },
      { name: 'response', type: 'uint8' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
      { name: 'tag', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

function resolveChain(chainId: number) {
  return chainId === 8453 ? base : baseSepolia;
}

function normalizePrivateKey(raw: string): Hex {
  const trimmed = raw.trim();
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as Hex;
}

export function resolveValidationRegistry(chainId: number): Address {
  const override = config.trust.erc8126ValidationRegistry;
  if (override) return override as Address;
  const address = ERC8004_VALIDATION_REGISTRY[chainId];
  if (!address) {
    throw new Error(`No ERC-8004 Validation Registry configured for chain ${chainId}`);
  }
  return address;
}

export function buildDataUri(payload: string): string {
  const base64 = Buffer.from(payload, 'utf8').toString('base64');
  return `data:application/json;base64,${base64}`;
}

export function hashPayload(payload: string): Hash {
  return keccak256(toBytes(payload));
}

export interface ValidationRegistryClients {
  publicClient: {
    waitForTransactionReceipt(input: { hash: Hash }): Promise<{ status: string }>;
  };
  walletClient: {
    writeContract(args: Record<string, unknown>): Promise<Hash>;
  };
  validatorAddress: Address;
  registryAddress: Address;
  chainId: number;
  chain: Chain;
}

export function createValidationRegistryClients(
  chainId = config.trust.chainId ?? DEFAULT_TRUST_CHAIN_ID,
): ValidationRegistryClients | null {
  const privateKey = config.trust.attesterPrivateKey;
  if (!privateKey) return null;

  const chain = resolveChain(chainId);
  const transport = http(config.trust.chainRpc || undefined);
  const account = privateKeyToAccount(normalizePrivateKey(privateKey));
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  return {
    publicClient: publicClient as ValidationRegistryClients['publicClient'],
    walletClient: walletClient as ValidationRegistryClients['walletClient'],
    validatorAddress: account.address,
    registryAddress: resolveValidationRegistry(chainId),
    chainId,
    chain,
  };
}

export async function submitValidationRequest(
  clients: ValidationRegistryClients,
  agentId: bigint,
  requestPayload: string,
): Promise<{ requestHash: Hash; requestUri: string; txHash: Hash }> {
  const requestUri = buildDataUri(requestPayload);
  const requestHash = hashPayload(requestPayload);

  const txHash = await clients.walletClient.writeContract({
    address: clients.registryAddress,
    abi: VALIDATION_REGISTRY_ABI,
    functionName: 'validationRequest',
    args: [clients.validatorAddress, agentId, requestUri, requestHash],
    gas: 2_000_000n,
    chain: clients.chain,
  });

  await clients.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { requestHash, requestUri, txHash };
}

export async function submitValidationResponse(
  clients: ValidationRegistryClients,
  requestHash: Hash,
  trustResponseScore: number,
  responsePayload: string,
): Promise<Hash> {
  const responseUri = buildDataUri(responsePayload);
  const responseHash = hashPayload(responsePayload);
  const tagBytes32 = stringToHex(ERC8126_VERIFICATION_TAG, { size: 32 });
  const response = Math.min(100, Math.max(0, Math.round(trustResponseScore)));

  const txHash = await clients.walletClient.writeContract({
    address: clients.registryAddress,
    abi: VALIDATION_REGISTRY_ABI,
    functionName: 'validationResponse',
    args: [requestHash, response, responseUri, responseHash, tagBytes32],
    gas: 2_000_000n,
    chain: clients.chain,
  });

  await clients.publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
