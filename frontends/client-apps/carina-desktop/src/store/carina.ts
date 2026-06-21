import { atom } from 'nanostores';

export type SecurityEvent = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  category?: string;
  at: string;
};

export type Plan = {
  id: string;
  name: string;
  tokenLimit: number | null;
  includedCredits: number | null;
  monthlyPriceGbp: number | null;
};

export type Usage = {
  periodStart: string;
  periodEnd: string;
  tokensUsed: number;
  tokenLimit: number;
  messagesSent: number;
  creditsRemaining: number;
  estimatedCostUsd: number;
  budgetStatus: string;
};

export type BillingSession = {
  sessionId: string;
  title: string;
  model: string;
  tokens: number;
  estimatedCostUsd: number;
};

export type Workspace = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sessionCount: number;
};

export type Commitment = {
  id: string;
  status: string;
  title: string;
  dueAt: string;
  sessionId: string;
  kind?: string;
  sourceSummary?: string;
};

export type LearningMetrics = {
  skillSuccessRate: number;
  memoriesExtractedWeekly: number;
  preferences: Array<{ preference: string; learnedAt: string }>;
  selfImprovementSkills: string[];
};

export type SystemHealth = {
  uptimeSeconds: number;
  gatewayStatus: string;
  heapUsedMb: number;
  queueDepth: number;
  suspended: boolean;
};

export type OrchestrationAgent = {
  id: string;
  name: string;
  status: string;
  task: string;
  startedAt: string;
  parentSessionId?: string;
};

export const $trustScore = atom<number>(0);
export const $scoutConnected = atom<boolean>(false);
export const $scoutUrl = atom<string | null>(null);
export const $securityEvents = atom<SecurityEvent[]>([]);
export const $killSwitchActive = atom<boolean>(false);
export const $killSwitchReason = atom<string>('');
export const $plan = atom<Plan | null>(null);
export const $usageThisPeriod = atom<Usage | null>(null);
export const $billingSessions = atom<BillingSession[]>([]);
export const $workspaces = atom<Workspace[]>([]);
export const $activeWorkspace = atom<Workspace | null>(null);
export const $commitments = atom<Commitment[]>([]);
export const $learningMetrics = atom<LearningMetrics | null>(null);
export const $systemHealth = atom<SystemHealth | null>(null);
export const $orchestrationAgents = atom<OrchestrationAgent[]>([]);
