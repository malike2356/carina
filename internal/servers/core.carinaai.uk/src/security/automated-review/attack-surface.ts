import type { ChangedFile, SecurityFinding } from './types.js';

const TOOL_NAME_PATTERN = /\bname:\s*['"]([a-z0-9-]+)['"]/;
const ROUTE_PATTERN = /\b(?:app|router)\.(?:get|post|put|patch|delete|all)\s*\(\s*['"]([^'"]+)['"]/;
const PERMISSION_PATTERN = /process\.env\.([A-Z0-9_]+)/g;

export function analyzeAttackSurface(files: ChangedFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const file of files) {
    if (file.status === 'deleted' || !file.content) continue;

    if (file.status === 'added' && /\/tools\//.test(file.path) && TOOL_NAME_PATTERN.test(file.content)) {
      const match = file.content.match(TOOL_NAME_PATTERN);
      findings.push({
        id: `attack-surface:tool:${file.path}`,
        severity: 'high',
        category: 'attack_surface',
        file: file.path,
        line: 1,
        description: `New tool module added${match?.[1] ? `: ${match[1]}` : ''}`,
        recommendation: 'Review tool risk tier, RBAC, approval policy, and egress rules.',
        autoFixable: false,
      });
    }

    if (/routes\/|\/api\/|gateway\//.test(file.path)) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const routeMatch = line.match(ROUTE_PATTERN);
        if (!routeMatch) continue;
        findings.push({
          id: `attack-surface:route:${file.path}:${i + 1}`,
          severity: 'medium',
          category: 'attack_surface',
          file: file.path,
          line: i + 1,
          description: `New HTTP route: ${routeMatch[1]}`,
          recommendation: 'Confirm authentication, authorization, rate limits, and input validation.',
          autoFixable: false,
        });
      }
    }

    if (file.status === 'added' && /(?:auth|security|policy)/i.test(file.path)) {
      findings.push({
        id: `attack-surface:policy:${file.path}`,
        severity: 'medium',
        category: 'policy',
        file: file.path,
        line: 1,
        description: 'Security-sensitive file added',
        recommendation: 'Require security review and add regression tests.',
        autoFixable: false,
      });
    }

    const envMatches = [...file.content.matchAll(PERMISSION_PATTERN)];
    for (const envMatch of envMatches) {
      const key = envMatch[1] ?? '';
      if (!/(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE)/i.test(key)) continue;
      const lineNumber = file.content.slice(0, envMatch.index ?? 0).split('\n').length;
      findings.push({
        id: `attack-surface:env:${file.path}:${key}`,
        severity: 'low',
        category: 'configuration',
        file: file.path,
        line: lineNumber,
        description: `References sensitive env var ${key}`,
        recommendation: 'Document the env var in .env.example and validate at startup.',
        autoFixable: false,
      });
    }
  }

  return findings;
}
