export type SkillSecurityIssue = {
  level: 'error' | 'warn';
  code: string;
  message: string;
};

export type SkillSecurityScan = {
  ok: boolean;
  issues: SkillSecurityIssue[];
};

const SECRET_PATTERNS: Array<{ code: string; pattern: RegExp; level: 'error' | 'warn'; message: string }> = [
  {
    code: 'secret.api_key',
    level: 'error',
    pattern: /\b(sk-[a-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,})\b/,
    message: 'Steps appear to embed a live API key or token',
  },
  {
    code: 'secret.password',
    level: 'error',
    pattern: /\b(password|passwd|api[_-]?secret)\s*[:=]\s*\S+/i,
    message: 'Steps appear to embed a password or secret assignment',
  },
  {
    code: 'destructive.shell',
    level: 'warn',
    pattern: /\brm\s+-rf\s+\/|\bmkfs\.|\bdd\s+if=/i,
    message: 'Steps reference destructive shell patterns',
  },
  {
    code: 'unsafe.eval',
    level: 'warn',
    pattern: /\beval\s*\(|new\s+Function\s*\(/i,
    message: 'Steps reference dynamic code execution',
  },
  {
    code: 'unsafe.curl_pipe',
    level: 'warn',
    pattern: /curl\s+[^\n|]*\|\s*(ba)?sh/i,
    message: 'Steps pipe remote curl output into a shell',
  },
];

export function scanSkillSecurity(content: {
  name: string;
  description?: string;
  steps?: string;
  trigger?: string[];
}): SkillSecurityScan {
  const blob = [
    content.name,
    content.description ?? '',
    content.steps ?? '',
    ...(content.trigger ?? []),
  ].join('\n');

  const issues: SkillSecurityIssue[] = [];
  for (const rule of SECRET_PATTERNS) {
    if (rule.pattern.test(blob)) {
      issues.push({
        level: rule.level,
        code: rule.code,
        message: `${content.name}: ${rule.message}`,
      });
    }
  }

  return {
    ok: issues.every((i) => i.level !== 'error'),
    issues,
  };
}

export function formatSkillSecurityScan(scan: SkillSecurityScan): string {
  return scan.issues.map((i) => `[${i.level}] ${i.code}: ${i.message}`).join('\n');
}
