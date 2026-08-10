/**
 * Client qualification scorecard (sales pipeline).
 * Advisory scoring before proposal; RED recommends walk-away (founder override audited).
 */

export const SCORECARD_CRITERIA = [
  'scope_creep',
  'budget_alignment',
  'decision_authority',
  'timeline_realism',
  'process_respect',
  'flattery_ratio',
  'reference_check',
  'payment_history',
] as const;

export type ScorecardCriterionId = (typeof SCORECARD_CRITERIA)[number];

export type QualificationRecommendation = 'GREEN' | 'YELLOW' | 'RED';

export type ScorecardWeights = Record<ScorecardCriterionId, number>;

export const DEFAULT_SCORECARD_WEIGHTS: ScorecardWeights = {
  scope_creep: 3,
  budget_alignment: 2,
  decision_authority: 2,
  timeline_realism: 2,
  process_respect: 1,
  flattery_ratio: 1,
  reference_check: 1,
  payment_history: 3,
};

export const SCORE_THRESHOLDS = {
  greenMin: 75,
  yellowMin: 50,
} as const;

export interface ClientQualificationProfile {
  /** Display / company name */
  name: string;
  email?: string;
  company?: string;
  industry?: string;
  dealSizeGbp?: number;
  leadId?: string;
  /** How many times scope changed during pre-deal talks */
  scopeChangeCount?: number;
  /** Budget covers stated scope */
  budgetMatchesScope?: boolean;
  /** Decision-maker present in conversations */
  decisionMakerPresent?: boolean;
  /** Timeline realistic for the work */
  timelineRealistic?: boolean;
  /** Prospect asked about process (vs only pitching their vision) */
  asksAboutProcess?: boolean;
  /** Compliments counted in recent talks */
  complimentCount?: number;
  /** Substantive process/scope questions counted */
  substantiveQuestionCount?: number;
  /** Known bad prior vendor history */
  badVendorHistory?: boolean;
  /** Known payment issues / non-payment */
  paymentIssues?: boolean;
  notes?: string;
}

export interface ScorecardFlag {
  criterionId: ScorecardCriterionId;
  label: string;
  severity: 'info' | 'warn' | 'critical';
  pointsDeducted: number;
  detail: string;
}

export interface ScorecardResult {
  score: number;
  recommendation: QualificationRecommendation;
  flags: ScorecardFlag[];
  automaticFail: boolean;
  automaticFailReason?: string;
  weightsUsed: ScorecardWeights;
  scoredAt: string;
  profileSnapshot: ClientQualificationProfile;
}

export interface ScorecardTemplate {
  id: string;
  name: string;
  weights: ScorecardWeights;
  thresholds: { greenMin: number; yellowMin: number };
  criteria: Array<{
    id: ScorecardCriterionId;
    label: string;
    description: string;
    defaultWeight: number;
  }>;
}

const CRITERION_META: Record<
  ScorecardCriterionId,
  { label: string; description: string }
> = {
  scope_creep: {
    label: 'Scope creep',
    description: 'Scope changed during talks before signing. Each change deducts heavily.',
  },
  budget_alignment: {
    label: 'Budget alignment',
    description: 'Budget must match the stated scope; under-budgeting is a warning.',
  },
  decision_authority: {
    label: 'Decision authority',
    description: 'Decision-maker should be in the room before proposal.',
  },
  timeline_realism: {
    label: 'Timeline realism',
    description: 'Compressed timelines without quality trade-offs are a red flag.',
  },
  process_respect: {
    label: 'Process respect',
    description: 'Prospect asks about process, not only sells their vision.',
  },
  flattery_ratio: {
    label: 'Flattery ratio',
    description: 'Compliments vs substantive questions above 2:1 is a gut-check flag.',
  },
  reference_check: {
    label: 'Reference check',
    description: 'Prior vendor relationships; blame-heavy histories score poorly.',
  },
  payment_history: {
    label: 'Payment history',
    description: 'Known payment issues are an automatic fail.',
  },
};

export function getDefaultScorecardTemplate(
  weights: ScorecardWeights = DEFAULT_SCORECARD_WEIGHTS,
): ScorecardTemplate {
  return {
    id: 'verlox-default',
    name: 'Verlox client qualification',
    weights: { ...weights },
    thresholds: { ...SCORE_THRESHOLDS },
    criteria: SCORECARD_CRITERIA.map((id) => ({
      id,
      label: CRITERION_META[id].label,
      description: CRITERION_META[id].description,
      defaultWeight: DEFAULT_SCORECARD_WEIGHTS[id],
    })),
  };
}

export function normalizeWeights(partial?: Partial<ScorecardWeights>): ScorecardWeights {
  const next = { ...DEFAULT_SCORECARD_WEIGHTS };
  if (!partial) return next;
  for (const id of SCORECARD_CRITERIA) {
    const value = partial[id];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      next[id] = value;
    }
  }
  return next;
}

function clampScore(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function recommendationFor(
  score: number,
  thresholds: { greenMin: number; yellowMin: number } = SCORE_THRESHOLDS,
): QualificationRecommendation {
  if (score >= thresholds.greenMin) return 'GREEN';
  if (score >= thresholds.yellowMin) return 'YELLOW';
  return 'RED';
}

/**
 * Score a prospective client. Starts at 100; applies weighted deductions.
 * Payment issues force RED / score 0 regardless of other criteria.
 */
export function scoreClient(
  clientProfile: ClientQualificationProfile,
  weightsInput?: Partial<ScorecardWeights>,
  thresholds: { greenMin: number; yellowMin: number } = SCORE_THRESHOLDS,
): ScorecardResult {
  const weights = normalizeWeights(weightsInput);
  const flags: ScorecardFlag[] = [];
  let score = 100;
  let automaticFail = false;
  let automaticFailReason: string | undefined;

  if (clientProfile.paymentIssues === true) {
    automaticFail = true;
    automaticFailReason = 'Known payment issues';
    flags.push({
      criterionId: 'payment_history',
      label: CRITERION_META.payment_history.label,
      severity: 'critical',
      pointsDeducted: 100,
      detail: 'Known payment issues or non-payment history = automatic FAIL',
    });
  }

  const scopeChanges = Math.max(0, Math.floor(clientProfile.scopeChangeCount ?? 0));
  if (scopeChanges > 0) {
    const base = 10 * scopeChanges;
    const deducted = base * weights.scope_creep;
    score -= deducted;
    flags.push({
      criterionId: 'scope_creep',
      label: CRITERION_META.scope_creep.label,
      severity: scopeChanges >= 2 ? 'critical' : 'warn',
      pointsDeducted: deducted,
      detail: `Scope changed ${scopeChanges} time(s) before signing (-10 x ${scopeChanges} x weight ${weights.scope_creep})`,
    });
  }

  if (clientProfile.budgetMatchesScope === false) {
    const deducted = 15 * weights.budget_alignment;
    score -= deducted;
    flags.push({
      criterionId: 'budget_alignment',
      label: CRITERION_META.budget_alignment.label,
      severity: 'warn',
      pointsDeducted: deducted,
      detail: `Budget does not match scope (-15 x weight ${weights.budget_alignment})`,
    });
  }

  if (clientProfile.decisionMakerPresent === false) {
    const deducted = 10 * weights.decision_authority;
    score -= deducted;
    flags.push({
      criterionId: 'decision_authority',
      label: CRITERION_META.decision_authority.label,
      severity: 'warn',
      pointsDeducted: deducted,
      detail: `Decision-maker not in the room (-10 x weight ${weights.decision_authority})`,
    });
  }

  if (clientProfile.timelineRealistic === false) {
    const deducted = 10 * weights.timeline_realism;
    score -= deducted;
    flags.push({
      criterionId: 'timeline_realism',
      label: CRITERION_META.timeline_realism.label,
      severity: 'warn',
      pointsDeducted: deducted,
      detail: `Timeline compressed / unrealistic (-10 x weight ${weights.timeline_realism})`,
    });
  }

  if (clientProfile.asksAboutProcess === false) {
    const deducted = 5 * weights.process_respect;
    score -= deducted;
    flags.push({
      criterionId: 'process_respect',
      label: CRITERION_META.process_respect.label,
      severity: 'info',
      pointsDeducted: deducted,
      detail: `No process questions; vision-only pitching (-5 x weight ${weights.process_respect})`,
    });
  }

  const compliments = Math.max(0, clientProfile.complimentCount ?? 0);
  const questions = Math.max(0, clientProfile.substantiveQuestionCount ?? 0);
  if (compliments > 0 && questions === 0) {
    const deducted = 5 * weights.flattery_ratio;
    score -= deducted;
    flags.push({
      criterionId: 'flattery_ratio',
      label: CRITERION_META.flattery_ratio.label,
      severity: 'warn',
      pointsDeducted: deducted,
      detail: `Flattery without substantive questions (${compliments}:0) (-5 x weight ${weights.flattery_ratio})`,
    });
  } else if (questions > 0 && compliments / questions > 2) {
    const deducted = 5 * weights.flattery_ratio;
    score -= deducted;
    flags.push({
      criterionId: 'flattery_ratio',
      label: CRITERION_META.flattery_ratio.label,
      severity: 'warn',
      pointsDeducted: deducted,
      detail: `Flattery ratio ${compliments}:${questions} exceeds 2:1 (-5 x weight ${weights.flattery_ratio})`,
    });
  }

  if (clientProfile.badVendorHistory === true) {
    const deducted = 10 * weights.reference_check;
    score -= deducted;
    flags.push({
      criterionId: 'reference_check',
      label: CRITERION_META.reference_check.label,
      severity: 'critical',
      pointsDeducted: deducted,
      detail: `Bad prior vendor history (-10 x weight ${weights.reference_check})`,
    });
  }

  if (automaticFail) {
    return {
      score: 0,
      recommendation: 'RED',
      flags,
      automaticFail: true,
      automaticFailReason,
      weightsUsed: weights,
      scoredAt: new Date().toISOString(),
      profileSnapshot: { ...clientProfile },
    };
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    recommendation: recommendationFor(finalScore, thresholds),
    flags,
    automaticFail: false,
    weightsUsed: weights,
    scoredAt: new Date().toISOString(),
    profileSnapshot: { ...clientProfile },
  };
}

/** Map recommendation to commercial next step (advisory). */
export function recommendationGuidance(rec: QualificationRecommendation): string {
  switch (rec) {
    case 'GREEN':
      return 'Proceed; scorecard supports sending a proposal.';
    case 'YELLOW':
      return 'Proceed only with retainer or milestone-based payment terms.';
    case 'RED':
      return 'Walk away recommended. Override requires logged founder approval.';
  }
}
