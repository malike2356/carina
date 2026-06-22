export type NodeStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type PairedNode = {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  tokenHash: string;
  publicKey?: string;
  pairingCodeHash?: string;
  status: 'online' | 'offline';
  pairedAt: string;
  lastSeenAt: string;
  approvedAt?: string;
};

export type PendingNodePairing = {
  id: string;
  code: string;
  name: string;
  hostname: string;
  platform: string;
  createdAt: string;
  expiresAt: string;
};

export type NodeCommandType = 'shell' | 'file.push' | 'file.pull' | 'ping';

export type NodeCommand = {
  id: string;
  nodeId: string;
  type: NodeCommandType;
  payload: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
};

export type NodeHostLocalConfig = {
  gatewayUrl: string;
  nodeId: string;
  token: string;
  name: string;
};

export type NodePairQrPayload = {
  v: 1;
  gatewayUrl: string;
  pendingId: string;
  code: string;
  name: string;
};
