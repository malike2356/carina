export type ShieldChannel =
  | 'email'
  | 'slack'
  | 'teams'
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'sms'
  | 'web';

export type ShieldVerdict = 'clean' | 'suspect' | 'malicious' | 'error';

export type QuarantineStatus = 'none' | 'held' | 'released' | 'destroyed';

export interface ShieldEnvelope {
  channel: ShieldChannel;
  workspaceId: string;
  protectionId: string;
  externalMessageId: string;
  conversationId: string;
  from: { id: string; display?: string; handles?: string[] };
  to: Array<{ id: string; display?: string }>;
  subject?: string;
  text: string;
  html?: string;
  links: string[];
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    sha256?: string;
    storageUri?: string;
  }>;
  rawStorageUri: string;
  receivedAt: string;
  authSignals: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ShieldProtection {
  id: string;
  workspaceId: string;
  channel: ShieldChannel;
  externalKey: string;
  mode: 'protect' | 'monitor' | 'off';
  status: 'active' | 'paused' | 'verify_pending' | 'disabled';
  deliveryTarget: Record<string, unknown>;
  policy: ShieldPolicy;
  scoutRefs: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ShieldPolicy {
  failClosedOnError: boolean;
  failClosedOnMalicious: boolean;
  autoReleaseSuspects: boolean;
  sandboxFileTypes: string[];
  notifyRoles: string[];
}

export const DEFAULT_SHIELD_POLICY: ShieldPolicy = {
  failClosedOnError: true,
  failClosedOnMalicious: true,
  autoReleaseSuspects: false,
  sandboxFileTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-msdownload',
    'application/zip',
    'application/x-dosexec',
  ],
  notifyRoles: ['security', 'admin'],
};

export interface ShieldMessage {
  id: string;
  protectionId: string;
  workspaceId: string;
  channel: ShieldChannel;
  externalMessageId: string;
  conversationId: string;
  envelope: ShieldEnvelope;
  rawStorageUri: string;
  verdict: ShieldVerdict | null;
  riskScore: number;
  quarantineStatus: QuarantineStatus;
  safeSummaryText: string | null;
  stageJson: Record<string, unknown>;
  scoutEventIds: string[];
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelShieldAdapter {
  channel: ShieldChannel;
  authenticateIngress(req: unknown): Promise<boolean>;
  ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope>;
  deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void>;
  notifySafeSummary(message: ShieldMessage, summary: string): Promise<void>;
  suppressOriginal?(envelope: ShieldEnvelope): Promise<void>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

export const SHIELD_CHANNELS: ShieldChannel[] = [
  'email',
  'slack',
  'teams',
  'telegram',
  'whatsapp',
  'discord',
  'sms',
  'web',
];
