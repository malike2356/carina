export type ResidencyMode = 'strict' | 'permissive';
export type DataTier = 'P0' | 'P1' | 'P2' | 'P3';
export type DrTier = 'standard' | 'enterprise' | 'premium';

export type EnterpriseSsoSession = {
  userId: string;
  email: string;
  provider: string;
  providerType: 'saml' | 'oidc' | 'ldap';
  orgRole: string;
  issuedAt: number;
  expiresAt: number;
};

export type ImmutableAuditEvent = {
  id: string;
  sequence: number;
  timestamp: number;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details: Record<string, unknown>;
  previousHash: string;
  eventHash: string;
  merkleRoot?: string;
};

export type MerkleRootRecord = {
  hour: string;
  rootHash: string;
  eventCount: number;
  firstSequence: number;
  lastSequence: number;
  publishedAt: number;
};

export type ResidencyConfig = {
  region: string;
  mode: ResidencyMode;
  encryption: string;
  storage: {
    postgresRegion: string;
    objectStoreRegion: string;
    kmsRegion: string;
  };
};

export type DrConfig = {
  tier: DrTier;
  primaryRegion: string;
  drRegion: string;
  rpoMinutes: number;
  rtoMinutes: number;
  backupIntervalMinutes: number;
};

export type DrStatus = {
  primaryHealthy: boolean;
  drStandbyHealthy: boolean;
  lastBackupAt: number | null;
  lastWalShipAt: number | null;
  rpoActualMinutes: number | null;
  rtoEstimatedMinutes: number | null;
  lastDrTestAt: number | null;
  lastDrTestPassed: boolean | null;
  nextDrTestAt: number | null;
};

export type NetworkPolicyRule = {
  from: string;
  to: string;
  port: number;
  protocol: 'tcp' | 'udp';
  action: 'allow' | 'deny';
};

export type ZeroTrustStatus = {
  mtlsEnabled: boolean;
  spiffeTrustDomain: string;
  policies: NetworkPolicyRule[];
  servicesWithIdentity: string[];
};

export type Soc2EvidenceManifest = {
  generatedAt: string;
  periodFrom: string;
  periodTo: string;
  controlCount: number;
  documentCount: number;
  packagePath: string;
  hashes: Record<string, string>;
};
