/**
 * Post-decline learning capture and pattern analysis for the qualification scorecard.
 */

import type { DeclineReason } from './walk-away-templates.js';
import type {
  ClientQualificationProfile,
  ScorecardCriterionId,
  ScorecardResult,
  ScorecardWeights,
} from './qualification-scorecard.js';
import { DEFAULT_SCORECARD_WEIGHTS, SCORECARD_CRITERIA } from './qualification-scorecard.js';

export interface DeclinedDealRecord {
  id: string;
  workspaceId: string;
  declinedAt: string;
  reason: DeclineReason;
  clientProfile: ClientQualificationProfile;
  scorecard: ScorecardResult;
  /** What to screen earlier next time */
  screenEarlier?: string;
  /** Free-form learning note */
  learningNotes?: string;
  /** What would have made this a yes */
  wouldHaveMadeYes?: string;
  industry?: string;
  dealSizeGbp?: number;
}

export interface PatternAnalysis {
  from: string;
  to: string;
  declinedCount: number;
  flagsByCriterion: Array<{ criterionId: ScorecardCriterionId; count: number }>;
  industries: Array<{ industry: string; count: number }>;
  dealSizeBuckets: Array<{ bucket: string; count: number }>;
  reasons: Array<{ reason: DeclineReason; count: number }>;
  topRecurringFlags: ScorecardCriterionId[];
}

export interface WeightSuggestion {
  criterionId: ScorecardCriterionId;
  currentWeight: number;
  suggestedWeight: number;
  rationale: string;
}

export interface WinLossByReason {
  reason: DeclineReason;
  declined: number;
  /** Future: when outcomes are linked after accepting similar deals */
  laterBadOutcome?: number;
}

export interface FounderOverrideRecord {
  id: string;
  workspaceId: string;
  at: string;
  leadId?: string;
  clientName: string;
  scorecardScore: number;
  recommendationWas: 'RED';
  approvedBy: string;
  justification: string;
}

function dealSizeBucket(gbp?: number): string {
  if (gbp == null || !Number.isFinite(gbp)) return 'unknown';
  if (gbp < 5_000) return 'under_5k';
  if (gbp < 25_000) return '5k_25k';
  if (gbp < 100_000) return '25k_100k';
  return '100k_plus';
}

export function buildDeclinedDealRecord(input: {
  workspaceId: string;
  clientProfile: ClientQualificationProfile;
  scorecard: ScorecardResult;
  reason: DeclineReason;
  screenEarlier?: string;
  learningNotes?: string;
  wouldHaveMadeYes?: string;
  id?: string;
}): DeclinedDealRecord {
  const id =
    input.id
    || `decline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    workspaceId: input.workspaceId,
    declinedAt: new Date().toISOString(),
    reason: input.reason,
    clientProfile: { ...input.clientProfile },
    scorecard: input.scorecard,
    screenEarlier: input.screenEarlier?.trim() || undefined,
    learningNotes: input.learningNotes?.trim() || undefined,
    wouldHaveMadeYes: input.wouldHaveMadeYes?.trim() || undefined,
    industry: input.clientProfile.industry,
    dealSizeGbp: input.clientProfile.dealSizeGbp,
  };
}

export function analyzePatterns(
  records: DeclinedDealRecord[],
  dateRange?: { from?: string; to?: string },
): PatternAnalysis {
  const from = dateRange?.from || '1970-01-01T00:00:00.000Z';
  const to = dateRange?.to || new Date().toISOString();
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const filtered = records.filter((r) => {
    const t = Date.parse(r.declinedAt);
    return Number.isFinite(t) && t >= fromMs && t <= toMs;
  });

  const flagCounts = new Map<ScorecardCriterionId, number>();
  const industryCounts = new Map<string, number>();
  const sizeCounts = new Map<string, number>();
  const reasonCounts = new Map<DeclineReason, number>();

  for (const rec of filtered) {
    reasonCounts.set(rec.reason, (reasonCounts.get(rec.reason) || 0) + 1);
    const industry = (rec.industry || rec.clientProfile.industry || 'unknown').trim() || 'unknown';
    industryCounts.set(industry, (industryCounts.get(industry) || 0) + 1);
    const bucket = dealSizeBucket(rec.dealSizeGbp ?? rec.clientProfile.dealSizeGbp);
    sizeCounts.set(bucket, (sizeCounts.get(bucket) || 0) + 1);
    for (const flag of rec.scorecard.flags) {
      flagCounts.set(flag.criterionId, (flagCounts.get(flag.criterionId) || 0) + 1);
    }
  }

  const flagsByCriterion = SCORECARD_CRITERIA.map((id) => ({
    criterionId: id,
    count: flagCounts.get(id) || 0,
  })).sort((a, b) => b.count - a.count);

  return {
    from,
    to,
    declinedCount: filtered.length,
    flagsByCriterion,
    industries: [...industryCounts.entries()]
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count),
    dealSizeBuckets: [...sizeCounts.entries()]
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => b.count - a.count),
    reasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    topRecurringFlags: flagsByCriterion.filter((f) => f.count > 0).slice(0, 5).map((f) => f.criterionId),
  };
}

/**
 * Suggest weight bumps for criteria that dominate declines.
 * Does not auto-apply; operator reviews quarterly.
 */
export function improveScorecard(
  patternAnalysis: PatternAnalysis,
  currentWeights: ScorecardWeights = DEFAULT_SCORECARD_WEIGHTS,
): WeightSuggestion[] {
  const suggestions: WeightSuggestion[] = [];
  const total = patternAnalysis.declinedCount || 1;
  for (const row of patternAnalysis.flagsByCriterion.slice(0, 3)) {
    if (row.count === 0) continue;
    const share = row.count / total;
    if (share < 0.25) continue;
    const current = currentWeights[row.criterionId];
    const bump = share >= 0.5 ? 1 : 0.5;
    suggestions.push({
      criterionId: row.criterionId,
      currentWeight: current,
      suggestedWeight: Math.round((current + bump) * 10) / 10,
      rationale: `Appeared in ${row.count}/${patternAnalysis.declinedCount} declines (${Math.round(share * 100)}%). Consider raising weight so this flag bites earlier.`,
    });
  }
  return suggestions;
}

export function getWinLossRatio(
  records: DeclinedDealRecord[],
  reason?: DeclineReason,
): WinLossByReason[] {
  const map = new Map<DeclineReason, number>();
  for (const rec of records) {
    if (reason && rec.reason !== reason) continue;
    map.set(rec.reason, (map.get(rec.reason) || 0) + 1);
  }
  return [...map.entries()].map(([r, declined]) => ({ reason: r, declined }));
}

/**
 * Quarterly validation stub: compare scorecard RED predictions to later bad outcomes
 * when operators tag accepted deals that went sideways.
 */
export interface QuarterlyOutcomeReview {
  periodFrom: string;
  periodTo: string;
  declinedCount: number;
  overridesCount: number;
  /** Accepted-then-bad deals tagged by operators (optional input) */
  badOutcomesAfterAccept: number;
  predictionNotes: string[];
}

export function buildQuarterlyReview(input: {
  declined: DeclinedDealRecord[];
  overrides: FounderOverrideRecord[];
  badOutcomesAfterAccept?: number;
  from: string;
  to: string;
}): QuarterlyOutcomeReview {
  const fromMs = Date.parse(input.from);
  const toMs = Date.parse(input.to);
  const declined = input.declined.filter((r) => {
    const t = Date.parse(r.declinedAt);
    return t >= fromMs && t <= toMs;
  });
  const overrides = input.overrides.filter((r) => {
    const t = Date.parse(r.at);
    return t >= fromMs && t <= toMs;
  });
  const bad = input.badOutcomesAfterAccept ?? 0;
  const notes: string[] = [
    `${declined.length} declines logged in period.`,
    `${overrides.length} RED founder overrides logged.`,
  ];
  if (bad > 0) {
    notes.push(
      `${bad} accepted deals later tagged as bad outcomes. Review whether scorecard would have flagged them earlier.`,
    );
  } else {
    notes.push('No accepted-then-bad outcomes tagged yet; keep capturing overrides and declines.');
  }
  return {
    periodFrom: input.from,
    periodTo: input.to,
    declinedCount: declined.length,
    overridesCount: overrides.length,
    badOutcomesAfterAccept: bad,
    predictionNotes: notes,
  };
}
