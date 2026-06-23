import { lintPackSkill, type SkillLintResult } from './skill-lint.js';
import { scanSkillSecurity, type SkillSecurityScan } from './skill-security.js';
import type { SkillAuthoringInput } from './skill-format.js';

export type SkillValidationResult = {
  ok: boolean;
  lint: SkillLintResult;
  security: SkillSecurityScan;
  issues: Array<{ level: 'error' | 'warn'; code: string; message: string }>;
};

export function validateSkillDocument(
  skill: SkillAuthoringInput,
  packName = 'user',
): SkillValidationResult {
  const lint = lintPackSkill(skill, packName);
  const security = scanSkillSecurity(skill);
  const issues = [
    ...lint.issues,
    ...security.issues,
  ];
  return {
    ok: lint.ok && security.ok,
    lint,
    security,
    issues,
  };
}

export function formatSkillValidation(result: SkillValidationResult): string {
  return result.issues.map((i) => `[${i.level}] ${i.code}: ${i.message}`).join('\n');
}
