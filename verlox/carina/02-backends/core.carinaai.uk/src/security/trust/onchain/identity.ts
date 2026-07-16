import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../../config/index.js';

export type Erc8004IdentityState = {
  standard: 'ERC-8004';
  registered: boolean;
  agentId: string | null;
  slug: string;
  name: string;
  chainId: number;
  registryAddress: string | null;
  registerTxHash: string | null;
  walletConfigured: boolean;
  status: 'live' | 'registering' | 'planned' | 'unconfigured';
};

const DEFAULT_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';

function packageVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(here, '../../../package.json'), 'utf8')) as {
      version?: string;
      name?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function resolveCarinaAgentSlug(): string {
  return (
    process.env.CARINA_TRUST_SLUG
    ?? process.env.LABYRINTH_INSTANCE_ID
    ?? config.labyrinth.instanceId
    ?? 'carina-local'
  );
}

export function buildErc8004IdentityState(): Erc8004IdentityState {
  const agentId = process.env.CARINA_TRUST_AGENT_ID?.trim() || null;
  const registerTxHash = process.env.CARINA_TRUST_REGISTER_TX?.trim() || null;
  const walletConfigured = Boolean(process.env.CARINA_TRUST_ATTESTER_KEY?.trim());
  const registered = Boolean(agentId);

  let status: Erc8004IdentityState['status'] = 'planned';
  if (registered) status = 'live';
  else if (walletConfigured) status = 'registering';
  else if (process.env.CARINA_TRUST_ENABLED === 'false') status = 'unconfigured';

  return {
    standard: 'ERC-8004',
    registered,
    agentId,
    slug: resolveCarinaAgentSlug(),
    name: process.env.CARINA_TRUST_AGENT_NAME ?? `Carina ${config.labyrinth.instanceName}`,
    chainId: parseInt(process.env.CARINA_TRUST_CHAIN_ID ?? '84532', 10),
    registryAddress: process.env.CARINA_TRUST_REGISTRY_ADDRESS ?? DEFAULT_REGISTRY,
    registerTxHash,
    walletConfigured,
    status,
  };
}

export function computeCarinaBuildFingerprint(): string {
  const version = packageVersion();
  const instanceId = config.labyrinth.instanceId;
  return createHash('sha256').update(`${version}:${instanceId}`).digest('hex');
}
