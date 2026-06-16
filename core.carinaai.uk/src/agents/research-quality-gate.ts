import type { DeepResearchReport } from './deep-research.js';

export type ResearchQualityResult = {
  passed: boolean;
  score: number;
  reasons: string[];
};

const MIN_SECTIONS = 3;
const MIN_SOURCES = 2;
const MIN_SUMMARY_CHARS = 40;
const MIN_BODY_CHARS = 120;

/** Explicit quality gate for deep research reports (Odysseus _should_stop pattern). */
export function evaluateResearchQuality(report: DeepResearchReport): ResearchQualityResult {
  const reasons: string[] = [];
  let score = 0;

  if (report.summary.trim().length >= MIN_SUMMARY_CHARS) {
    score += 25;
  } else {
    reasons.push('summary too short');
  }

  if (report.sections.length >= MIN_SECTIONS) {
    score += 25;
  } else {
    reasons.push(`need at least ${MIN_SECTIONS} sections`);
  }

  const bodyChars = report.sections.reduce((n, s) => n + s.body.trim().length, 0);
  if (bodyChars >= MIN_BODY_CHARS) {
    score += 20;
  } else {
    reasons.push('section bodies too thin');
  }

  const verified = report.sources.filter((s) => s.verified !== false).length;
  if (report.sources.length >= MIN_SOURCES) {
    score += 15;
  } else {
    reasons.push(`need at least ${MIN_SOURCES} sources`);
  }

  if (verified >= Math.min(MIN_SOURCES, report.sources.length)) {
    score += 15;
  } else {
    reasons.push('insufficient verified sources');
  }

  const citedSections = report.sections.filter((s) => s.sourceCitations.length > 0).length;
  if (citedSections >= 1 || report.sources.length === 0) {
    score += 10;
  } else {
    reasons.push('sections missing source citations');
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

export function passesResearchQualityGate(report: DeepResearchReport): boolean {
  const result = evaluateResearchQuality(report);
  return result.score >= researchQualityThreshold() && result.reasons.length === 0;
}
