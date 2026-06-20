export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ReviewVerdict = 'approved' | 'needs_review' | 'blocked';

export type ChangedFile = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  patch?: string;
  content?: string;
};

export type SecurityFinding = {
  id: string;
  severity: ReviewSeverity;
  category: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  autoFixable: boolean;
  ruleId?: string;
};

export type SecurityReview = {
  prNumber?: number;
  sha?: string;
  author?: string;
  files: ChangedFile[];
  findings: SecurityFinding[];
  verdict: ReviewVerdict;
  score: number;
  dependencyFindings: SecurityFinding[];
  attackSurfaceFindings: SecurityFinding[];
  scoutNote?: string;
  reviewedAt: string;
};

export type ScoutReviewInput = {
  prNumber?: number;
  author?: string;
  files: ChangedFile[];
  findings: SecurityFinding[];
};

export type ScoutReviewResult = {
  source: 'scout' | 'local_fallback' | 'disabled';
  trusted: boolean;
  riskScore: number;
  note: string;
  extraFindings: SecurityFinding[];
};
