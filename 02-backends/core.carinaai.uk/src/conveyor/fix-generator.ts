/**
 * Human-approved fix proposals for audit findings (never auto-applied).
 */
import type { FixProposal, LayerId, LayerResult } from './types.js';

const TEMPLATES: Record<string, (finding: string, file?: string) => { title: string; body: string; confidence: number }> = {
  cors: () => ({
    title: 'Add security middleware',
    body: `import helmet from 'helmet';\napp.use(helmet());\napp.use(cors({ origin: ALLOWED_ORIGINS }));\n`,
    confidence: 0.9,
  }),
  stack: (msg, file) => ({
    title: 'Hide stack traces from clients',
    body: `// ${file ?? 'handler'}\nres.status(500).json({ error: 'Internal error' });\nlogger.error({ err }, 'request failed');\n`,
    confidence: 0.92,
  }),
  secret: (_m, file) => ({
    title: 'Move secret to environment',
    body: `# .env (gitignored)\nAPI_KEY=\n\n# ${file ?? 'config'}\nconst apiKey = process.env.API_KEY;\nif (!apiKey) throw new Error('API_KEY required');\n`,
    confidence: 0.95,
  }),
  gitignore: () => ({
    title: 'Ignore environment files',
    body: `.env\n.env.*\n!.env.example\n`,
    confidence: 0.98,
  }),
  health: () => ({
    title: 'Add health endpoint',
    body: `app.get('/health', (_req, res) => res.status(200).json({ ok: true }));\n`,
    confidence: 0.9,
  }),
  rate: () => ({
    title: 'Add rate limiting',
    body: `import rateLimit from 'express-rate-limit';\napp.use('/api', rateLimit({ windowMs: 60_000, max: 120 }));\n`,
    confidence: 0.88,
  }),
  session: () => ({
    title: 'Session expiration + revocation',
    body: `session({ cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true, secure: true } });\n// on password change: await revokeAllSessions(userId);\n`,
    confidence: 0.85,
  }),
  ci: () => ({
    title: 'Add CI workflow',
    body: `name: ci\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n`,
    confidence: 0.9,
  }),
  backup: () => ({
    title: 'Document backup/restore',
    body: `# Backup\n- Nightly encrypted DB dump to offsite storage\n- Monthly restore drill with checklist\n- RPO/RTO targets recorded in ops runbook\n`,
    confidence: 0.8,
  }),
  env: () => ({
    title: 'Separate environment config',
    body: `NODE_ENV=production\nDATABASE_URL= # prod only\n# staging uses a distinct DATABASE_URL and keys\n`,
    confidence: 0.86,
  }),
};

function pickTemplate(message: string): keyof typeof TEMPLATES | null {
  const m = message.toLowerCase();
  if (m.includes('cors') || m.includes('helmet') || m.includes('csp') || m.includes('security middleware') || m.includes('sql')) {
    return 'cors';
  }
  if (m.includes('stack') || m.includes('public/private error') || m.includes('error separation')) {
    return 'stack';
  }
  if (m.includes('hardcoded secret') || m.includes('secret scanning') || m.includes('secret')) {
    return 'secret';
  }
  if (m.includes('gitignore') || m.includes('not ignored')) return 'gitignore';
  if (m.includes('health') || m.includes('uptime') || m.includes('monitoring')) return 'health';
  if (m.includes('rate limit') || m.includes('waf')) return 'rate';
  if (m.includes('session') || m.includes('cookie')) return 'session';
  if (m.includes('ci workflow') || m.includes('rollback') || m.includes('blue-green') || m.includes('deploy')) {
    return 'ci';
  }
  if (m.includes('backup') || m.includes('disaster')) return 'backup';
  if (m.includes('database') || m.includes('environment') || m.includes('.env.example') || m.includes('shared/dev')) {
    return 'env';
  }
  if (m.includes('structured logger') || m.includes('audit trail') || m.includes('sensitive field')) {
    return 'stack';
  }
  if (m.includes('gdpr') || m.includes('privacy') || m.includes('consent') || m.includes('ai act') || m.includes('sgi')) {
    return 'env';
  }
  if (m.includes('caching') || m.includes('bundle') || m.includes('aria') || m.includes('accessibility') || m.includes('wcag')) {
    return 'health';
  }
  if (m.includes('auth gate')) return 'cors';
  return null;
}

export function generateFix(auditFailure: {
  layerId: LayerId;
  message: string;
  file?: string;
  suggestedFix?: string;
}): FixProposal {
  const key = pickTemplate(auditFailure.message);
  const tpl = key
    ? TEMPLATES[key]!(auditFailure.message, auditFailure.file)
    : {
        title: `Address: ${auditFailure.message.slice(0, 72)}`,
        body: `${auditFailure.suggestedFix ?? 'Follow the suggestedFix from the audit finding.'}\n`,
        confidence: 0.7,
      };
  return {
    layerId: auditFailure.layerId,
    findingMessage: auditFailure.message,
    title: tpl.title,
    patchOrConfig: tpl.body,
    requiresHumanApproval: true,
    confidence: tpl.confidence,
  };
}

export function generateFixesForReport(layers: LayerResult[]): FixProposal[] {
  const fixes: FixProposal[] = [];
  for (const layer of layers) {
    for (const finding of layer.findings) {
      if (finding.severity === 'info') continue;
      fixes.push(
        generateFix({
          layerId: layer.id,
          message: finding.message,
          file: finding.file,
          suggestedFix: finding.suggestedFix,
        }),
      );
    }
  }
  return fixes;
}

/** Coverage of common (critical/warning) failure messages that map to a template. */
export function fixTemplateCoverage(messages: string[]): number {
  const common = messages.filter((m) => m.trim().length > 0);
  if (!common.length) return 1;
  const hit = common.filter((m) => pickTemplate(m)).length;
  return hit / common.length;
}
