import { analyzeAttackSurface } from './attack-surface.js';
import { runDependencyScan } from './dependency-scan.js';
import { reviewWithScout } from './scout-review.js';
import { runStaticAnalysis } from './static-analysis.js';
import type {
  ChangedFile,
  ReviewVerdict,
  SecurityFinding,
  SecurityReview,
} from './types.js';

const SEVERITY_WEIGHT: Record<SecurityFinding['severity'], number> = {
  critical: 25,
  high: 15,
  medium: 5,
  low: 2,
};

export function computeSecurityScore(findings: SecurityFinding[]): number {
  let score = 100;
  for (const finding of findings) {
    score -= SEVERITY_WEIGHT[finding.severity];
  }
  return Math.max(0, Math.min(100, score));
}

export function determineVerdict(findings: SecurityFinding[], scoutTrusted = true): ReviewVerdict {
  if (findings.some((f) => f.severity === 'critical')) return 'blocked';
  if (!scoutTrusted) return 'needs_review';
  if (findings.some((f) => f.severity === 'high')) return 'needs_review';
  return 'approved';
}

export function dedupeFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>();
  const out: SecurityFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.file}:${finding.line}:${finding.description}:${finding.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(finding);
  }
  return out;
}

export type RunSecurityReviewOptions = {
  prNumber?: number;
  sha?: string;
  author?: string;
  files: ChangedFile[];
  includeDependencyScan?: boolean;
  runAudit?: () => Promise<{ stdout: string; stderr: string; status: number | null }>;
  skipScout?: boolean;
};

export async function runSecurityReview(options: RunSecurityReviewOptions): Promise<SecurityReview> {
  const staticFindings = runStaticAnalysis(options.files);
  const attackSurfaceFindings = analyzeAttackSurface(options.files);
  const dependencyFindings = options.includeDependencyScan && options.runAudit
    ? await runDependencyScan(options.runAudit)
    : [];

  let scoutNote: string | undefined;
  let scoutFindings: SecurityFinding[] = [];
  let scoutTrusted = true;

  if (!options.skipScout) {
    const preliminary = dedupeFindings([...staticFindings, ...attackSurfaceFindings, ...dependencyFindings]);
    const scout = await reviewWithScout({
      prNumber: options.prNumber,
      author: options.author,
      files: options.files,
      findings: preliminary,
    });
    scoutNote = scout.note;
    scoutFindings = scout.extraFindings;
    scoutTrusted = scout.trusted;
    if (!scout.trusted && scout.riskScore >= 70) {
      scoutFindings.push({
        id: 'scout:untrusted-author',
        severity: 'high',
        category: 'scout',
        file: 'pull_request',
        line: 0,
        description: 'Scout trust check flagged this change set',
        recommendation: 'Require manual security review before merge.',
        autoFixable: false,
      });
    }
  }

  const findings = dedupeFindings([
    ...staticFindings,
    ...attackSurfaceFindings,
    ...dependencyFindings,
    ...scoutFindings,
  ]);

  const score = computeSecurityScore(findings);
  const verdict = determineVerdict(findings, scoutTrusted);

  return {
    prNumber: options.prNumber,
    sha: options.sha,
    author: options.author,
    files: options.files,
    findings,
    verdict,
    score,
    dependencyFindings,
    attackSurfaceFindings,
    scoutNote,
    reviewedAt: new Date().toISOString(),
  };
}

export function formatReviewMarkdown(review: SecurityReview): string {
  const lines: string[] = [
    '# Carina automated security review',
    '',
    `Verdict: **${review.verdict.toUpperCase()}**`,
    `Score: **${review.score}/100**`,
    `Files reviewed: ${review.files.length}`,
  ];
  if (review.scoutNote) lines.push(`Scout: ${review.scoutNote}`);
  lines.push('');

  if (review.findings.length === 0) {
    lines.push('No security findings.');
    return lines.join('\n');
  }

  lines.push('| Severity | Category | File | Line | Finding |');
  lines.push('|----------|----------|------|-----:|---------|');
  for (const finding of review.findings) {
    lines.push(
      `| ${finding.severity} | ${finding.category} | ${finding.file} | ${finding.line} | ${finding.description} |`,
    );
  }
  lines.push('');
  lines.push('## Recommendations');
  for (const finding of review.findings) {
    lines.push(`- \`${finding.file}:${finding.line}\` ${finding.recommendation}`);
  }
  return lines.join('\n');
}

export function formatReviewSummary(review: SecurityReview): string {
  const counts = {
    critical: review.findings.filter((f) => f.severity === 'critical').length,
    high: review.findings.filter((f) => f.severity === 'high').length,
    medium: review.findings.filter((f) => f.severity === 'medium').length,
    low: review.findings.filter((f) => f.severity === 'low').length,
  };
  return [
    `Security review: ${review.verdict} (${review.score}/100)`,
    `Findings: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`,
  ].join('\n');
}

export function shouldBlockCi(review: SecurityReview): boolean {
  return review.verdict === 'blocked';
}

export function shouldWarnCi(review: SecurityReview): boolean {
  return review.verdict === 'needs_review';
}
