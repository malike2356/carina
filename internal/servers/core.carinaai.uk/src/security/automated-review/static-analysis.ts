import { REVIEW_RULES, type ReviewRule } from './review-rules.js';
import type { ChangedFile, SecurityFinding } from './types.js';

function importsChildProcess(content: string): boolean {
  return /(?:import|require)\s*(?:[\s\S]*?from\s*['"]child_process['"]|(?:\([^)]*\)\s*)?['"]child_process['"])/m.test(content);
}

function lineMatchesRule(line: string, rule: ReviewRule, content: string): boolean {
  if (line.trim().startsWith('//') || line.trim().startsWith('*')) return false;
  if (rule.requiresChildProcessImport && !importsChildProcess(content)) return false;
  return rule.pattern.test(line);
}

export function scanFileContent(filePath: string, content: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  for (const rule of REVIEW_RULES) {
    if (rule.fileFilter && !rule.fileFilter.test(filePath)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!lineMatchesRule(line, rule, content)) continue;
      findings.push({
        id: `${rule.id}:${filePath}:${i + 1}`,
        severity: rule.severity,
        category: rule.category,
        file: filePath,
        line: i + 1,
        description: rule.message,
        recommendation: rule.recommendation,
        autoFixable: Boolean(rule.autoFixable),
        ruleId: rule.id,
      });
    }
  }

  return findings;
}

export function runStaticAnalysis(files: ChangedFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    if (file.status === 'deleted') continue;
    if (!file.content) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.path)) continue;
    findings.push(...scanFileContent(file.path, file.content));
  }
  return findings;
}
