import type { ReviewSeverity } from './types.js';

export type ReviewRule = {
  id: string;
  pattern: RegExp;
  severity: ReviewSeverity;
  category: string;
  message: string;
  recommendation: string;
  autoFixable?: boolean;
  fileFilter?: RegExp;
  requiresChildProcessImport?: boolean;
};

export const REVIEW_RULES: ReviewRule[] = [
  {
    id: 'code-injection-eval',
    pattern: /\beval\s*\(|new\s+Function\s*\(|exec\s*\([^)]*user[_-]?input/i,
    severity: 'critical',
    category: 'code_injection',
    message: 'Code injection risk',
    recommendation: 'Remove dynamic code execution or validate and sandbox all inputs.',
  },
  {
    id: 'hardcoded-credential',
    pattern: /(?:password|api[_-]?key|secret|token)\s*[=:]\s*['"][^'"\s]{6,}['"]/i,
    severity: 'critical',
    category: 'secrets',
    message: 'Hardcoded credential',
    recommendation: 'Load secrets from environment variables or a secret manager.',
  },
  {
    id: 'hardcoded-internal-ip',
    pattern: /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    severity: 'critical',
    category: 'network',
    message: 'Hardcoded internal IP',
    recommendation: 'Use configuration or service discovery instead of literal internal URLs.',
  },
  {
    id: 'new-tool-registration',
    pattern: /\bname:\s*['"][a-z0-9-]+['"][\s\S]{0,120}\b(?:dangerous|requiresConfirmation|execute\s*:)/,
    severity: 'high',
    category: 'attack_surface',
    message: 'New tool registration; review attack surface',
    recommendation: 'Document tool risk tier, approval policy, and egress implications before merge.',
    fileFilter: /\/tools\//,
  },
  {
    id: 'child-process-exec',
    pattern: /child_process\.(?:exec|execSync)\s*\(/,
    severity: 'high',
    category: 'shell_execution',
    message: 'Shell execution via exec; prefer spawn with argument array',
    recommendation: 'Use child_process.spawn with argv arrays and avoid shell interpolation.',
  },
  {
    id: 'destructured-child-process-exec',
    pattern: /\b(?:execSync|exec)\s*\(/,
    severity: 'high',
    category: 'shell_execution',
    message: 'Shell execution via exec; prefer spawn with argument array',
    recommendation: 'Use child_process.spawn with argv arrays and avoid shell interpolation.',
    requiresChildProcessImport: true,
  },
  {
    id: 'inner-html-assignment',
    pattern: /\.innerHTML\s*=/,
    severity: 'medium',
    category: 'xss',
    message: 'innerHTML assignment; prefer textContent or safe DOM APIs',
    recommendation: 'Use textContent, setAttribute, or a trusted sanitizer.',
    autoFixable: false,
  },
  {
    id: 'credential-log-leak',
    pattern: /console\.(?:log|info|debug|warn|error)\([^)]*(?:token|key|secret|password)/i,
    severity: 'medium',
    category: 'logging',
    message: 'Possible credential leak in logs',
    recommendation: 'Redact sensitive values before logging.',
  },
  {
    id: 'disable-security-check',
    pattern: /(?:skip|disable|bypass).*(?:auth|security|approval|scout|rbac)/i,
    severity: 'high',
    category: 'policy',
    message: 'Possible security control bypass',
    recommendation: 'Remove bypass flags or gate them behind explicit test-only guards.',
  },
  {
    id: 'unsafe-fetch-http',
    pattern: /fetch\s*\(\s*['"]http:\/\//,
    severity: 'medium',
    category: 'network',
    message: 'Plain HTTP fetch',
    recommendation: 'Use HTTPS endpoints or enforce TLS in egress filters.',
  },
];
