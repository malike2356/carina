import {
  type AuditContext,
  type LayerResult,
  CRITICAL_LAYER_IDS,
  DEFAULT_THRESHOLD,
  rel,
  scoreFromFindings,
  layerPassed,
} from '../types.js';

function base(
  id: LayerResult['id'],
  name: string,
  findings: LayerResult['findings'],
  threshold = DEFAULT_THRESHOLD,
): LayerResult {
  const critical = CRITICAL_LAYER_IDS.includes(id);
  const score = scoreFromFindings(findings, critical);
  return {
    id,
    name,
    score,
    critical,
    findings,
    passed: layerPassed(score, threshold),
  };
}

export function checkSecurity(ctx: AuditContext): LayerResult {
  const findings = [];
  const texts = ctx.files.map((f) => ({ f, t: ctx.readText(f) ?? '' }));
  const hasCors = texts.some(({ t }) => /cors|Access-Control-Allow/i.test(t));
  const hasCsp = texts.some(({ t }) => /Content-Security-Policy|contentSecurityPolicy/i.test(t));
  const hasHelmet = texts.some(({ t }) => /helmet\(|helmet\./i.test(t));
  if (!hasCors && !hasHelmet) {
    findings.push({
      severity: 'critical' as const,
      message: 'No CORS / helmet / security middleware patterns found',
      suggestedFix: 'Add helmet() or explicit CORS allowlist middleware for HTTP apps.',
    });
  }
  if (!hasCsp && !hasHelmet) {
    findings.push({
      severity: 'warning' as const,
      message: 'No Content-Security-Policy configuration detected',
      suggestedFix: 'Set CSP via helmet.contentSecurityPolicy or reverse-proxy headers.',
    });
  }
  const openSql = texts.find(({ t }) => /\$\{[^}]*req\.|query\s*\(\s*[`'"].*\$\{/i.test(t));
  if (openSql) {
    findings.push({
      severity: 'critical' as const,
      message: 'Possible string-interpolated SQL/query construction',
      file: rel(ctx, openSql.f),
      suggestedFix: 'Use parameterized queries / ORM bindings; never interpolate user input.',
    });
  }
  const auth = texts.some(({ t }) => /get_current_user|requireAuth|authorizeOps|passport|jwt\.verify/i.test(t));
  if (!auth) {
    findings.push({
      severity: 'warning' as const,
      message: 'No obvious auth gate helpers found',
      suggestedFix: 'Protect mutating routes with auth middleware and capability checks.',
    });
  }
  return base('security', 'Security', findings);
}

export function checkErrorHandling(ctx: AuditContext): LayerResult {
  const findings = [];
  for (const f of ctx.files) {
    const t = ctx.readText(f) ?? '';
    if (/res\.(json|send)\([^)]*err\.stack|stack:\s*err/i.test(t)) {
      findings.push({
        severity: 'critical' as const,
        message: 'Stack traces may be returned to clients',
        file: rel(ctx, f),
        suggestedFix: 'Return generic public errors; log stack privately only.',
      });
    }
    if (/console\.log\(err\.stack\)/i.test(t) && /api|route|handler/i.test(f)) {
      findings.push({
        severity: 'warning' as const,
        message: 'Raw error stacks logged via console in API path',
        file: rel(ctx, f),
        suggestedFix: 'Use structured logger with redaction; avoid dumping stacks to stdout in prod.',
      });
    }
  }
  const hasPublicPrivate = ctx.files.some((f) => {
    const t = ctx.readText(f) ?? '';
    return /publicError|toPublicError|safeError|INTERNAL_ERROR/i.test(t);
  });
  if (!hasPublicPrivate) {
    findings.push({
      severity: 'warning' as const,
      message: 'No public/private error separation helper detected',
      suggestedFix: 'Introduce a publicError(message) helper that never leaks internals.',
    });
  }
  return base('error-handling', 'Error handling', findings);
}

export function checkEnvironment(ctx: AuditContext): LayerResult {
  const findings = [];
  const envExample = ctx.files.find((f) => f.endsWith('.env.example'));
  const envFile = ctx.files.find((f) => /(^|\/)\.env$/.test(f));
  const gitignore = ctx.readText('.gitignore') ?? ctx.files.map((f) => (f.endsWith('.gitignore') ? ctx.readText(f) : null)).find(Boolean) ?? '';
  if (envFile && !/\.env/m.test(gitignore)) {
    findings.push({
      severity: 'critical' as const,
      message: '.env present but not ignored by .gitignore',
      file: rel(ctx, envFile),
      suggestedFix: 'Add .env to .gitignore and rotate any secrets that may have leaked.',
    });
  }
  if (!envExample && !ctx.files.some((f) => /\.env\.example$/.test(f))) {
    findings.push({
      severity: 'warning' as const,
      message: 'No .env.example documenting required variables',
      suggestedFix: 'Add .env.example with placeholder values (no real secrets).',
    });
  }
  for (const f of ctx.files) {
    const t = ctx.readText(f) ?? '';
    if (/NODE_ENV\s*===\s*['"]production['"]/.test(t) || /APP_ENV/.test(t)) {
      // good signal
    }
  }
  const sharedDb = ctx.files.find((f) => {
    const t = ctx.readText(f) ?? '';
    return /DATABASE_URL=.*localhost|shared.?db|same.?db.?for.?prod.?and.?dev/i.test(t);
  });
  if (sharedDb) {
    findings.push({
      severity: 'critical' as const,
      message: 'Possible shared/dev database URL baked into tree',
      file: rel(ctx, sharedDb),
      suggestedFix: 'Use distinct DATABASE_URL per environment; never point prod at localhost/shared DBs.',
    });
  }
  return base('environment', 'Environment separation', findings);
}

export function checkLogging(ctx: AuditContext): LayerResult {
  const findings = [];
  const structured = ctx.files.some((f) => {
    const t = ctx.readText(f) ?? '';
    return /pino\(|winston\.|structured.?log|logger\.(info|error)/i.test(t);
  });
  if (!structured) {
    findings.push({
      severity: 'warning' as const,
      message: 'No structured logger usage detected',
      suggestedFix: 'Adopt pino/winston (or equivalent) with JSON logs and request ids.',
    });
  }
  const leaks = ctx.files.find((f) => {
    const t = ctx.readText(f) ?? '';
    return /log.*(password|api[_-]?key|secret|authorization)/i.test(t);
  });
  if (leaks) {
    findings.push({
      severity: 'critical' as const,
      message: 'Possible sensitive field logging',
      file: rel(ctx, leaks),
      suggestedFix: 'Redact password, token, and Authorization fields before logging.',
    });
  }
  const audit = ctx.files.some((f) => /audit(_|-)?(log|trail|event)/i.test(f) || /appendOnly|audit_log/i.test(ctx.readText(f) ?? ''));
  if (!audit) {
    findings.push({
      severity: 'info' as const,
      message: 'No audit trail module naming detected',
      suggestedFix: 'Add immutable audit events for auth, billing, and admin mutations.',
    });
  }
  return base('logging', 'Logging', findings);
}

export function checkMonitoring(ctx: AuditContext): LayerResult {
  const findings = [];
  const health = ctx.files.some((f) => {
    const t = ctx.readText(f) ?? '';
    return /\/health|healthcheck|readiness|liveness/i.test(t) || /health/.test(f);
  });
  if (!health) {
    findings.push({
      severity: 'critical' as const,
      message: 'No health/readiness endpoint patterns found',
      suggestedFix: 'Expose GET /health (and optionally /ready) returning HTTP 200 when dependencies are up.',
    });
  }
  const uptime = ctx.files.some((f) => /uptime|statuspage|sentry|prometheus|otel|opentelemetry/i.test(ctx.readText(f) ?? ''));
  if (!uptime) {
    findings.push({
      severity: 'warning' as const,
      message: 'No uptime/monitoring hook patterns found',
      suggestedFix: 'Wire Sentry/OTel or status-page heartbeats for production.',
    });
  }
  return base('monitoring', 'Monitoring', findings);
}

export function checkRateLimiting(ctx: AuditContext): LayerResult {
  const findings = [];
  const rl = ctx.files.some((f) => /rateLimit|rate-limit|express-rate-limit|slowapi|throttle/i.test(ctx.readText(f) ?? ''));
  if (!rl) {
    findings.push({
      severity: 'critical' as const,
      message: 'No API rate limiting middleware detected',
      suggestedFix: 'Add per-IP and per-user rate limits on auth and public APIs; document WAF rules.',
    });
  }
  const waf = ctx.files.some((f) => /waf|cloudflare|modsecurity/i.test(ctx.readText(f) ?? ''));
  if (!waf) {
    findings.push({
      severity: 'info' as const,
      message: 'No WAF configuration references found',
      suggestedFix: 'Terminate TLS behind Cloudflare/nginx WAF with bot and abuse rules.',
    });
  }
  return base('rate-limiting', 'Rate limiting', findings);
}

export function checkSecrets(ctx: AuditContext): LayerResult {
  const findings = [];
  const secretRe =
    /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-]{12,}['"]|sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}/i;
  for (const f of ctx.files) {
    if (/\.env\.example$/.test(f)) continue;
    const t = ctx.readText(f) ?? '';
    if (secretRe.test(t) && !/\.env$/.test(f)) {
      findings.push({
        severity: 'critical' as const,
        message: 'Possible hardcoded secret in source',
        file: rel(ctx, f),
        suggestedFix: 'Move secrets to env/vault; rotate the exposed value; add secret scanning hooks.',
      });
    }
  }
  const gitignore = ctx.files.find((f) => f.endsWith('.gitignore'));
  const gi = gitignore ? ctx.readText(gitignore) ?? '' : '';
  if (!/\.env/m.test(gi)) {
    findings.push({
      severity: 'critical' as const,
      message: '.env not listed in .gitignore',
      suggestedFix: 'Ignore .env and credential files; keep only .env.example tracked.',
    });
  }
  const hook = ctx.files.some((f) => /pre-commit|gitleaks|secret.?scan|detect-secrets/i.test(f) || /pre-commit|gitleaks/.test(ctx.readText(f) ?? ''));
  if (!hook) {
    findings.push({
      severity: 'warning' as const,
      message: 'No pre-commit secret scanning hook detected',
      suggestedFix: 'Add gitleaks/detect-secrets (or workspace secret-scanning) to pre-commit/CI.',
    });
  }
  return base('secrets', 'Secret management', findings);
}

export function checkSessions(ctx: AuditContext): LayerResult {
  const findings = [];
  const session = ctx.files.some((f) => /session|maxAge|cookie\.|revokeSession|password.?change/i.test(ctx.readText(f) ?? ''));
  if (!session) {
    findings.push({
      severity: 'critical' as const,
      message: 'No session/cookie expiration patterns found',
      suggestedFix: 'Set session maxAge, httpOnly/secure cookies, and revoke sessions on password change.',
    });
  } else {
    const expire = ctx.files.some((f) => /maxAge|expires|ttl|session.?timeout/i.test(ctx.readText(f) ?? ''));
    if (!expire) {
      findings.push({
        severity: 'warning' as const,
        message: 'Session usage found but no explicit expiration/TTL',
        suggestedFix: 'Define absolute and idle session timeouts.',
      });
    }
    const revoke = ctx.files.some((f) => /revok|invalidate.*session|logout.?all/i.test(ctx.readText(f) ?? ''));
    if (!revoke) {
      findings.push({
        severity: 'warning' as const,
        message: 'No session revocation on credential change detected',
        suggestedFix: 'Invalidate all sessions when password or MFA changes.',
      });
    }
  }
  return base('sessions', 'Session management', findings);
}

export function checkAccessibility(ctx: AuditContext): LayerResult {
  const findings = [];
  const ui = ctx.files.filter((f) => /\.(tsx|jsx|vue|html|blade\.php)$/i.test(f));
  if (ui.length === 0) {
    findings.push({
      severity: 'info' as const,
      message: 'No UI templates found; accessibility check skipped lightly',
      suggestedFix: 'When UI is added, enforce WCAG 2.1 AA (labels, contrast, keyboard).',
    });
    return base('accessibility', 'Accessibility', findings);
  }
  const aria = ui.some((f) => /aria-|alt=|role=/i.test(ctx.readText(f) ?? ''));
  if (!aria) {
    findings.push({
      severity: 'warning' as const,
      message: 'UI files lack obvious aria/alt/role attributes',
      suggestedFix: 'Add accessible names, alt text, and keyboard focus styles (WCAG AA).',
    });
  }
  return base('accessibility', 'Accessibility', findings);
}

export function checkCompliance(ctx: AuditContext): LayerResult {
  const findings = [];
  const gdpr = ctx.files.some((f) => /gdpr|privacy.?policy|consent|data.?subject|right.?to.?erasure/i.test(ctx.readText(f) ?? ''));
  if (!gdpr) {
    findings.push({
      severity: 'warning' as const,
      message: 'No GDPR/privacy consent patterns found',
      suggestedFix: 'Add consent gates, privacy policy links, and deletion/export workflows.',
    });
  }
  const aiAct = ctx.files.some((f) => /EU.?AI.?Act|SGI|synthetically.?generated|ai.?disclosure/i.test(ctx.readText(f) ?? ''));
  if (!aiAct) {
    findings.push({
      severity: 'info' as const,
      message: 'No AI Act / SGI disclosure labeling detected',
      suggestedFix: 'Label AI-generated outputs where required; document risk classification.',
    });
  }
  return base('compliance', 'Compliance', findings);
}

export function checkPerformance(ctx: AuditContext): LayerResult {
  const findings = [];
  const cache = ctx.files.some((f) => /cache|redis|CDN|etag|stale-while-revalidate/i.test(ctx.readText(f) ?? ''));
  if (!cache) {
    findings.push({
      severity: 'warning' as const,
      message: 'No caching strategy signals found',
      suggestedFix: 'Add HTTP/CDN caching and Redis (or equivalent) for hot reads.',
    });
  }
  const bundle = ctx.files.some((f) => /bundle.?analy|webpack-bundle|next.?build|vite.?build/i.test(ctx.readText(f) ?? '') || /package\.json$/.test(f));
  if (!bundle) {
    findings.push({
      severity: 'info' as const,
      message: 'No build/bundle tooling detected',
      suggestedFix: 'Track frontend bundle size budgets in CI.',
    });
  }
  return base('performance', 'Performance', findings);
}

export function checkBackup(ctx: AuditContext): LayerResult {
  const findings = [];
  const backup = ctx.files.some((f) => /backup|disaster.?recovery|pg_dump|point.?in.?time|restore/i.test(f) || /backup|pg_dump|restore/i.test(ctx.readText(f) ?? ''));
  if (!backup) {
    findings.push({
      severity: 'critical' as const,
      message: 'No backup/DR documentation or scripts found',
      suggestedFix: 'Document DB backup schedule, retention, and restore drill; automate nightly dumps.',
    });
  }
  return base('backup', 'Backup and recovery', findings);
}

export function checkDeployment(ctx: AuditContext): LayerResult {
  const findings = [];
  const ci = ctx.files.some((f) => /\.github\/workflows\//.test(f) || /gitlab-ci|\.circleci|Jenkinsfile/i.test(f));
  if (!ci) {
    findings.push({
      severity: 'critical' as const,
      message: 'No CI workflow files found',
      suggestedFix: 'Add GitHub Actions (or GitLab CI) for test + deploy with required checks.',
    });
  }
  const rollback = ctx.files.some((f) => /rollback|blue.?green|canary|deploy-atomic/i.test(f) || /rollback|blue-green|deploy-atomic/i.test(ctx.readText(f) ?? ''));
  if (!rollback) {
    findings.push({
      severity: 'warning' as const,
      message: 'No rollback / blue-green deploy references found',
      suggestedFix: 'Document and automate rollback (atomic image tags or previous release).',
    });
  }
  return base('deployment', 'Deployment', findings);
}
