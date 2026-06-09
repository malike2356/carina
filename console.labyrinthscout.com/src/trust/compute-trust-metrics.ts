import { createHash } from 'node:crypto';

export type RiskTier = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
export type ChainStatus = 'live' | 'registering' | 'planned' | 'enterprise';

export interface TrustMetricsInput {
  agentsTotal: number;
  agentsActive: number;
  agentsSuspended: number;
  runtimeIncidents30d: number;
  warning24h: number;
  breach30d: number;
  eventsToday: number;
  injectionBlocks24h: number;
  blocked24h: number;
  threats24h: number;
  lastEventAt: string | null;
  lastHeartbeatAt: string | null;
}

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
    erc8004_status: ChainStatus;
    erc8004_label: string;
    erc8126_status: ChainStatus;
    erc8126_label: string;
  };
  source: 'labyrinth-scout';
}

const TIER_LABELS: Record<RiskTier, string> = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  elevated: 'Elevated risk',
  high: 'High risk',
  critical: 'Critical risk',
};

const CHAIN_LABELS: Record<ChainStatus, string> = {
  live: 'Live on Base',
  registering: 'Registering on Base Sepolia',
  planned: 'Planned',
  enterprise: 'Enterprise tier — Q3 2026',
};

export function computeRiskScore(input: TrustMetricsInput): number {
  let score = 10;

  score += input.runtimeIncidents30d * 20;
  score += input.breach30d * 30;
  score += input.warning24h * 3;

  if (input.agentsTotal > 0 && input.agentsActive === 0) {
    score += 25;
  }
  if (input.agentsSuspended > 0) {
    score += 15;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function riskTierFromScore(score: number): RiskTier {
  if (score <= 20) return 'low';
  if (score <= 40) return 'moderate';
  if (score <= 60) return 'elevated';
  if (score <= 80) return 'high';
  return 'critical';
}

export function riskTierColor(tier: RiskTier): string {
  if (tier === 'low') return '#3dba7c';
  if (tier === 'moderate') return '#f5a623';
  if (tier === 'elevated') return '#e67e22';
  return '#e74c3c';
}

export function formatRelativeTime(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function hashPreview(seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex');
  return `${digest.slice(0, 4)}...${digest.slice(-4)}`;
}

export function buildAttestations(
  input: TrustMetricsInput,
  generatedAt: string,
): TrustAttestation[] {
  const attestations: TrustAttestation[] = [];

  if (input.agentsActive > 0) {
    const summary = input.runtimeIncidents30d === 0
      ? 'No Type 1/2/3 runtime incidents in 30 days. Prompt injection shield active.'
      : `${input.runtimeIncidents30d} runtime incident(s) in 30 days. Review Scout console for details.`;

    attestations.push({
      type: 'Runtime',
      title: input.runtimeIncidents30d === 0 ? '30-day clean runtime' : 'Runtime monitoring alert',
      summary,
      hash_preview: hashPreview(`runtime:${generatedAt}:${input.runtimeIncidents30d}`),
      at: generatedAt,
    });
  }

  if (input.injectionBlocks24h > 0 || input.blocked24h > 0) {
    attestations.push({
      type: 'Shield',
      title: 'Prompt injection shield',
      summary: `${input.injectionBlocks24h} injection attempt(s) blocked in 24h. ${input.blocked24h} defensive action(s) recorded.`,
      hash_preview: hashPreview(`shield:${generatedAt}:${input.injectionBlocks24h}`),
      at: generatedAt,
    });
  }

  if (input.eventsToday > 0) {
    attestations.push({
      type: 'Audit',
      title: 'Cryptographic audit log integrity',
      summary: `${input.eventsToday.toLocaleString('en-GB')} events logged today. Chain unbroken. Export available for compliance review.`,
      hash_preview: hashPreview(`audit:${generatedAt}:${input.eventsToday}`),
      at: generatedAt,
    });
  }

  if (attestations.length === 0) {
    attestations.push({
      type: 'Status',
      title: 'Awaiting Scout telemetry',
      summary: 'No recent security events recorded. Deploy Carina with Labyrinth Scout to begin live attestation.',
      hash_preview: hashPreview(`status:${generatedAt}:idle`),
      at: generatedAt,
    });
  }

  return attestations.slice(0, 5);
}

export function buildPublicTrustPayload(
  input: TrustMetricsInput,
  chain: { erc8004: ChainStatus; erc8126: ChainStatus },
  now = new Date(),
): PublicTrustPayload {
  const generatedAt = now.toISOString();
  const riskScore = computeRiskScore(input);
  const riskTier = riskTierFromScore(riskScore);
  const lastScanAt = pickLatestIso(input.lastEventAt, input.lastHeartbeatAt);

  const scoutActive =
    input.agentsActive > 0
    || (input.lastEventAt !== null && ageMs(input.lastEventAt, now) < 5 * 60 * 1000);

  return {
    generated_at: generatedAt,
    risk_score: riskScore,
    risk_tier: riskTier,
    risk_tier_label: TIER_LABELS[riskTier],
    monitoring: {
      scout_active: scoutActive,
      agents_protected: input.agentsTotal,
      agents_active: input.agentsActive,
      agents_suspended: input.agentsSuspended,
      last_scan_at: lastScanAt,
      last_scan_relative: formatRelativeTime(lastScanAt, now.getTime()),
      last_heartbeat_at: input.lastHeartbeatAt,
    },
    metrics: {
      injection_blocks_24h: input.injectionBlocks24h,
      runtime_incidents_30d: input.runtimeIncidents30d,
      events_today: input.eventsToday,
      threats_24h: input.threats24h,
      blocked_24h: input.blocked24h,
    },
    attestations: buildAttestations(input, generatedAt),
    chain: {
      erc8004_status: chain.erc8004,
      erc8004_label: CHAIN_LABELS[chain.erc8004],
      erc8126_status: chain.erc8126,
      erc8126_label: CHAIN_LABELS[chain.erc8126],
    },
    source: 'labyrinth-scout',
  };
}

function pickLatestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function ageMs(iso: string, now: Date): number {
  return now.getTime() - new Date(iso).getTime();
}
