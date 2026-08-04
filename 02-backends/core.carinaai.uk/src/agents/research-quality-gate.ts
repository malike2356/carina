import type { DeepResearchReport, ResearchDepthConfig } from './deep-research.js';

export type ResearchQualityResult = {
  passed: boolean;
  score: number;
  reasons: string[];
};

const DEFAULT_MIN_SECTIONS = 3;
const DEFAULT_MIN_SOURCES = 2;
const DEFAULT_MIN_SUMMARY_CHARS = 40;
const DEFAULT_MIN_BODY_CHARS = 120;

/** Explicit quality gate for deep research reports (_should_stop pattern). */
export function evaluateResearchQuality(
  report: DeepResearchReport,
  depth?: Pick<ResearchDepthConfig, 'minSections' | 'minBodyChars' | 'minSummaryChars' | 'maxSources'>,
): ResearchQualityResult {
  const minSections = depth?.minSections ?? DEFAULT_MIN_SECTIONS;
  const minSources = depth
    ? Math.max(DEFAULT_MIN_SOURCES, Math.min(8, Math.ceil(depth.maxSources / 4)))
    : DEFAULT_MIN_SOURCES;
  const minSummaryChars = depth?.minSummaryChars ?? DEFAULT_MIN_SUMMARY_CHARS;
  const minBodyChars = depth?.minBodyChars ?? DEFAULT_MIN_BODY_CHARS;

  const reasons: string[] = [];
  let score = 0;

  if (report.summary.trim().length >= minSummaryChars) {
    score += 25;
  } else {
    reasons.push('summary too short');
  }

  if (report.sections.length >= minSections) {
    score += 25;
  } else {
    reasons.push(`need at least ${minSections} sections`);
  }

  const bodyChars = report.sections.reduce((n, s) => n + s.body.trim().length, 0);
  if (bodyChars >= minBodyChars) {
    score += 20;
  } else {
    reasons.push('section bodies too thin');
  }

  const verified = report.sources.filter((s) => s.verified !== false).length;
  if (report.sources.length >= minSources) {
    score += 15;
  } else {
    reasons.push(`need at least ${minSources} sources`);
  }

  if (report.sources.length > 0 && verified >= Math.min(minSources, report.sources.length)) {
    score += 15;
  } else if (report.sources.length > 0) {
    reasons.push('insufficient verified sources');
  }

  const citedSections = report.sections.filter((s) => s.sourceCitations.length > 0).length;
  if (report.sources.length > 0 && citedSections >= 1) {
    score += 10;
  } else if (report.sources.length > 0) {
    reasons.push('sections missing source citations');
  }

  const summary = report.summary.trim().toLowerCase();
  if (!summary || summary === 'summary unavailable.' || summary === 'summary unavailable') {
    reasons.push('summary unavailable');
  }

  const bodyJoined = report.sections.map((s) => s.body.trim()).join('\n').toLowerCase();
  if (
    /i('|\u2019)?ll start by researching/.test(bodyJoined)
    || /let me (start by )?(research|search)/.test(bodyJoined)
  ) {
    reasons.push('report looks like an unfinished agent preamble');
  }

  return {
    passed: score >= researchQualityThreshold() && reasons.length === 0,
    score,
    reasons,
  };
}

export function researchQualityThreshold(): number {
  const raw = Number(process.env.CARINA_RESEARCH_QUALITY_MIN ?? '75');
  return Number.isFinite(raw) ? Math.min(100, Math.max(50, raw)) : 75;
}

export function passesResearchQualityGate(
  report: DeepResearchReport,
  depth?: Pick<ResearchDepthConfig, 'minSections' | 'minBodyChars' | 'minSummaryChars' | 'maxSources'>,
): boolean {
  const result = evaluateResearchQuality(report, depth);
  return result.score >= researchQualityThreshold() && result.reasons.length === 0;
}
