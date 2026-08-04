import { config } from '../../config/index.js';
import type { ScoutReviewInput, ScoutReviewResult, SecurityFinding } from './types.js';

const HIGH_RISK_PATHS = [
  /\/security\//,
  /\/tools\//,
  /\/gateway\//,
  /\/auth\//,
  /routes\//,
];

export async function reviewWithScout(input: ScoutReviewInput): Promise<ScoutReviewResult> {
  if (process.env.LABYRINTH_ENABLED !== 'true' || !config.labyrinth.apiKey) {
    return reviewWithLocalFallback(input);
  }

  try {
    const base = config.labyrinth.url.replace(/\/$/, '');
    const res = await fetch(`${base}/api/policy/review-pr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': config.labyrinth.apiKey,
      },
      body: JSON.stringify({
        pr_number: input.prNumber,
        author: input.author,
        files: input.files.map((f) => ({ path: f.path, status: f.status })),
        finding_count: input.findings.length,
      }),
      signal: AbortSignal.timeout(config.labyrinth.judgeTimeoutMs ?? 5000),
    });

    if (!res.ok) {
      return reviewWithLocalFallback(input, `Scout review HTTP ${res.status}`);
    }

    const data = await res.json() as {
      trusted?: boolean;
      risk_score?: number;
      note?: string;
      findings?: Array<{ severity?: string; description?: string; file?: string; line?: number }>;
    };

    const extraFindings: SecurityFinding[] = (data.findings ?? []).map((finding, index) => ({
      id: `scout:${index + 1}`,
      severity: (finding.severity as SecurityFinding['severity']) ?? 'medium',
      category: 'scout',
      file: finding.file ?? 'unknown',
      line: finding.line ?? 0,
      description: finding.description ?? 'Scout flagged this change',
      recommendation: 'Review Scout guidance before merge.',
      autoFixable: false,
    }));

    return {
      source: 'scout',
      trusted: data.trusted !== false,
      riskScore: data.risk_score ?? 50,
      note: data.note ?? 'Scout PR review completed',
      extraFindings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return reviewWithLocalFallback(input, msg);
  }
}

export function reviewWithLocalFallback(
  input: ScoutReviewInput,
  reason = 'Scout unavailable',
): ScoutReviewResult {
  const extraFindings: SecurityFinding[] = [];
  let riskScore = 20;

  for (const file of input.files) {
    if (file.status !== 'added') continue;
    if (!HIGH_RISK_PATHS.some((pattern) => pattern.test(file.path))) continue;
    extraFindings.push({
      id: `scout-local:path:${file.path}`,
      severity: 'medium',
      category: 'scout',
      file: file.path,
      line: 1,
      description: 'High-risk path changed while Scout review is offline',
      recommendation: 'Request manual security review for security, tools, gateway, or auth changes.',
      autoFixable: false,
    });
    riskScore += 10;
  }

  const criticalCount = input.findings.filter((f) => f.severity === 'critical').length;
  riskScore += criticalCount * 20;

  return {
    source: 'local_fallback',
    trusted: criticalCount === 0,
    riskScore: Math.min(100, riskScore),
    note: `${reason}; used local Scout fallback heuristics`,
    extraFindings,
  };
}
