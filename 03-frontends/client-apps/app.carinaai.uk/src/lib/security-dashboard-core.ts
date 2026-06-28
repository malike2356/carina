import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export type SecurityEvent = {
  id: string;
  timestamp: string;
  label: string;
  action: 'blocked' | 'monitor' | 'alert' | 'log';
  agentId: string;
  sessionId?: string;
  source: string;
};

export type SecurityDashboardData = {
  generatedAt: string;
  threatLevel: ThreatLevel;
  activeThreats: number;
  trustScore: number;
  trustScoreTrend: number;
  trustHistory: Array<{ date: string; score: number }>;
  incidentsThisWeek: number;
  incidentsTrend: number;
  raspStatus: 'active' | 'degraded' | 'offline';
  scoutStatus: { connected: boolean; armed: boolean; url: string | null };
  realTimeEvents: SecurityEvent[];
  complianceStatus: {
    overallScorePercent: number;
    overallStatus: string;
    frameworks: Array<{ id: string; name: string; scorePercent: number }>;
  };
  supplyChainHealth: {
    dependencyCount: number;
    vulnerabilityCount: number;
    criticalCount: number;
    sbomGeneratedAt: string | null;
    lastScanAt: string | null;
    verdict: string;
  };
  secretsStatus: {
    activeCount: number;
    expiringSoonCount: number;
    staleCount: number;
    rows: Array<{ provider: string; expiresInDays: number; stale: boolean }>;
  };
  redTeamResults: {
    lastRunAt: string | null;
    exercisesRun: number;
    passedCount: number;
    totalCount: number;
    passRatePercent: number;
    criticalGaps: number;
  };
  recentIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    detectedAt: number;
  }>;
  governanceHealthy: boolean;
  killSwitchActive: boolean;
};

function coreAuthHeaders(): Record<string, string> {
  const token = resolveCoreProxyToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-internal-key'] = token;
  }
  return headers;
}

export function securityDashboardCoreConfigured(): boolean {
  return coreProxyEnabled();
}

export async function fetchSecurityDashboardFromCore(): Promise<SecurityDashboardData> {
  const coreUrl = resolveCoreUrl();
  const response = await fetch(`${coreUrl}/api/security/dashboard`, {
    headers: coreAuthHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Core dashboard failed (${response.status})`);
  }
  return response.json() as Promise<SecurityDashboardData>;
}

export async function fetchSecurityDashboardStreamFromCore(
  signal?: AbortSignal,
): Promise<Response> {
  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  const response = await fetch(`${coreUrl}/api/security/dashboard/stream`, {
    headers: coreAuthHeaders(),
    cache: 'no-store',
    signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Core dashboard stream failed (${response.status})`);
  }
  return response;
}

export function buildDevSecurityDashboardStub(): SecurityDashboardData {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    threatLevel: 'low',
    activeThreats: 0,
    trustScore: 92,
    trustScoreTrend: 2,
    trustHistory: Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(Date.now() - (6 - index) * 86_400_000).toISOString().slice(0, 10);
      return { date, score: 88 + index };
    }),
    incidentsThisWeek: 0,
    incidentsTrend: 0,
    raspStatus: 'active',
    scoutStatus: { connected: false, armed: false, url: null },
    realTimeEvents: [],
    complianceStatus: {
      overallScorePercent: 94,
      overallStatus: 'compliant',
      frameworks: [
        { id: 'soc2', name: 'SOC 2', scorePercent: 94 },
        { id: 'iso27001', name: 'ISO 27001', scorePercent: 88 },
        { id: 'gdpr', name: 'GDPR', scorePercent: 100 },
      ],
    },
    supplyChainHealth: {
      dependencyCount: 0,
      vulnerabilityCount: 0,
      criticalCount: 0,
      sbomGeneratedAt: null,
      lastScanAt: null,
      verdict: 'unknown',
    },
    secretsStatus: {
      activeCount: 0,
      expiringSoonCount: 0,
      staleCount: 0,
      rows: [],
    },
    redTeamResults: {
      lastRunAt: null,
      exercisesRun: 0,
      passedCount: 0,
      totalCount: 0,
      passRatePercent: 0,
      criticalGaps: 0,
    },
    recentIncidents: [],
    governanceHealthy: true,
    killSwitchActive: false,
  };
}
