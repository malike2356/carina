import { describe, expect, it } from 'vitest';
import { analyzeAttackSurface } from './attack-surface.js';
import { parseNpmAuditReport } from './dependency-scan.js';
import { reviewWithLocalFallback } from './scout-review.js';
import { scanFileContent } from './static-analysis.js';
import {
  computeSecurityScore,
  determineVerdict,
  formatReviewSummary,
  runSecurityReview,
} from './review-bot.js';
import type { ChangedFile } from './types.js';

describe('automated security review static analysis', () => {
  it('flags critical code injection patterns', () => {
    const findings = scanFileContent(
      'src/tools/evil.ts',
      'const x = eval(userInput);\n',
    );
    expect(findings.some((f) => f.severity === 'critical')).toBe(true);
  });

  it('flags hardcoded credentials', () => {
    const findings = scanFileContent(
      'src/config.ts',
      "const password = 'super-secret-value';\n",
    );
    expect(findings.some((f) => f.ruleId === 'hardcoded-credential')).toBe(true);
  });

  it('flags high-risk child_process exec usage', () => {
    const findings = scanFileContent(
      'src/tools/shell.ts',
      "import { exec } from 'child_process';\nexec('rm -rf /');\n",
    );
    expect(findings.some((f) => f.severity === 'high')).toBe(true);
  });
});

describe('attack surface analysis', () => {
  it('flags newly added tool modules', () => {
    const files: ChangedFile[] = [{
      path: 'src/tools/demo-tool.ts',
      status: 'added',
      content: "export const demo = { name: 'demo-tool', execute: async () => null };",
    }];
    const findings = analyzeAttackSurface(files);
    expect(findings.some((f) => f.category === 'attack_surface')).toBe(true);
  });
});

describe('dependency scan parsing', () => {
  it('maps npm audit advisories to findings', () => {
    const findings = parseNpmAuditReport({
      advisories: {
        1: {
          severity: 'high',
          title: 'Prototype pollution',
          module_name: 'lodash',
          url: 'https://example.com/advisory',
        },
      },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('high');
  });
});

describe('scout fallback review', () => {
  it('adds findings for high-risk paths when Scout is offline', () => {
    const result = reviewWithLocalFallback({
      files: [{ path: 'src/security/new-policy.ts', status: 'added', content: 'export {}' }],
      findings: [],
    });
    expect(result.source).toBe('local_fallback');
    expect(result.extraFindings.length).toBeGreaterThan(0);
  });
});

describe('review bot verdicts', () => {
  it('blocks on critical findings', () => {
    expect(determineVerdict([{
      id: 'x',
      severity: 'critical',
      category: 'secrets',
      file: 'a.ts',
      line: 1,
      description: 'bad',
      recommendation: 'fix',
      autoFixable: false,
    }])).toBe('blocked');
  });

  it('needs review for high findings', () => {
    expect(determineVerdict([{
      id: 'x',
      severity: 'high',
      category: 'attack_surface',
      file: 'a.ts',
      line: 1,
      description: 'bad',
      recommendation: 'fix',
      autoFixable: false,
    }])).toBe('needs_review');
  });

  it('approves clean changes', () => {
    expect(determineVerdict([])).toBe('approved');
    expect(computeSecurityScore([])).toBe(100);
  });

  it('runs full pipeline on changed files', async () => {
    const review = await runSecurityReview({
      files: [{
        path: 'src/tmp/insecure.ts',
        status: 'added',
        content: "const password = 'hardcoded-secret-value';\n",
      }],
      skipScout: true,
      includeDependencyScan: false,
    });
    expect(review.verdict).toBe('blocked');
    expect(review.findings.length).toBeGreaterThan(0);
    expect(formatReviewSummary(review)).toContain('blocked');
  });
});
