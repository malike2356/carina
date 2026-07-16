export type InstanceMode = 'cloud' | 'self-hosted';

export interface InstanceConfig {
  mode: InstanceMode;
  baseUrl: string;
  sessionId: string;
}

export interface CarinaHealth {
  ok: boolean;
  mode?: string;
}

export interface CarinaConfig {
  provider: string;
  providers: string[];
  web?: { port: number };
}

export interface ProvidersResponse {
  providers: string[];
  active: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  provider?: string;
}

export interface ChatStreamChunk {
  content?: string;
  error?: string;
  access?: ChatAccessInfo;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  provider?: string;
  toolsUsed?: string[];
  createdAt: string;
  status?: 'streaming' | 'done' | 'error';
  inferenceType?: 'cloud' | 'local';
  accessMode?: ChatAccessInfo['mode'];
  source?: string;
}

export interface ChatAccessInfo {
  mode: 'platform' | 'byok' | 'mini';
  freeMessagesUsed: number;
  freeMessagesLimit: number;
  upgradeUrl: string;
  byokUrl: string;
  provider?: string;
  model?: string;
}

export interface SessionPrefs {
  customTitle?: string;
  pinned?: boolean;
  pinnedAt?: string;
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messageCount: number;
  customTitle?: string;
  pinned?: boolean;
  pinnedAt?: string;
}

export interface HostedUser {
  id: string;
  email: string;
  tier: string;
  scoutActive: boolean;
}

export interface MeResponse {
  id: string;
  email: string;
  tier: string;
  apiKey: string | null;
  scoutActive: boolean;
  org: { id: string; name: string; role: string; plan?: string } | null;
}

export interface ScoutKeyResponse {
  apiKey: string;
  instanceId: string;
  envSnippet: string;
}

export interface SwitchProviderResponse {
  ok: boolean;
  active: string;
  reply?: string;
  providers?: string[];
}

export interface HostedContext {
  hosted: boolean;
  user: HostedUser | null;
  installedPacks: Array<{ pack_name: string; version: string; status: string }>;
}

export type AgentTaskStatus = 'running' | 'completed' | 'failed';

export type AgentTaskKind = 'auto' | 'assigned';

export interface AgentTask {
  id: string;
  sessionId: string;
  prompt: string;
  status: AgentTaskStatus;
  kind?: AgentTaskKind;
  startedAt: string;
  completedAt?: string;
  toolsUsed?: string[];
  summary?: string;
}

export type RiskTier = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

export interface TrustAttestation {
  type: string;
  title: string;
  summary: string;
  hash_preview: string;
  at: string;
}

export interface PublicTrustPayload {
  generated_at: string;
  risk_score: number;
  risk_tier: RiskTier;
  risk_tier_label: string;
  monitoring: {
    scout_active: boolean;
    agents_protected: number;
    agents_active: number;
    agents_suspended: number;
    last_scan_at: string | null;
    last_scan_relative: string | null;
    last_heartbeat_at: string | null;
  };
  metrics: {
    injection_blocks_24h: number;
    runtime_incidents_30d: number;
    events_today: number;
    threats_24h: number;
    blocked_24h: number;
  };
  attestations: TrustAttestation[];
  chain: {
    erc8004_status: string;
    erc8004_label: string;
    erc8126_status: string;
    erc8126_label: string;
  };
  source: string;
}

export type SecuritySeverity = 'info' | 'warning' | 'critical' | 'breach';

export interface ScoutSecurityEvent {
  id: string;
  severity: SecuritySeverity;
  source: string;
  event_type: string;
  description: string;
  instance_id?: string | null;
  created_at: string;
  acknowledged?: boolean;
}

export interface HostedScoutStatus {
  active: boolean;
  tier?: string;
  plan?: string | null;
  status?: string | null;
  instanceId?: string;
  scoutKeyMasked?: string;
  events: ScoutSecurityEvent[];
  instances: unknown[];
}

export interface KillSwitchStatus {
  armed: boolean;
  triggered: boolean;
  triggered_by: string | null;
  reason: string | null;
  agents_active?: number;
}

export interface KillSwitchTriggerResult {
  triggered: boolean;
  agents_stopped?: number;
  duration_ms?: number;
  error?: string;
}

export interface EpisodicMemory {
  id: string;
  category: string;
  content: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryListResponse {
  entries: EpisodicMemory[];
  page: number;
  total_pages: number;
  total: number;
}

export interface MemorySessionRow {
  session_id: string;
  title: string;
  last_active: string;
  preview: string;
}

export interface MemorySessionsResponse {
  sessions: MemorySessionRow[];
}

export interface MemoryStatsResponse {
  categories: Array<{ category: string; count: string; chars: string }>;
}

export interface PackMeta {
  name: string;
  version: string;
  description: string;
  author: string;
  skill_count: number;
  download_count: number;
}

export interface InstalledPack {
  pack_name: string;
  version: string;
  installed_at: string;
  status: string;
}

export interface PackConfigResponse {
  config: Record<string, unknown>;
}

export interface ActivePacksResponse {
  active: string[];
  installed: InstalledPack[];
  management: string;
  lastChange?: { at: string; by: string; source: string };
  source?: string;
}

export interface CustomResourceFile {
  kind: string;
  filename: string;
  size: number;
  modified: string;
}

export interface QueuedMessage {
  id: string;
  text: string;
  createdAt: string;
}
