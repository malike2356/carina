import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runFullAudit,
  generateFixesForReport,
  fixTemplateCoverage,
  runPipeline,
  CRITICAL_LAYER_IDS,
} from './index.js';

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
}

describe('conveyor prototype-to-production', () => {
  it('runs all 13 layers on a prototype and fails critical thresholds', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conveyor-proto-'));
    writeTree(root, {
      'package.json': '{"name":"proto"}',
      '.gitignore': 'node_modules\n',
      'src/config.js': "const API_KEY = 'sk-test-hardcoded-secret-value';\n",
      'src/api.js': 'app.get("/x", (req,res)=>res.json({stack: err.stack}));\n',
      '.env': 'DATABASE_URL=postgres://localhost/shared\n',
    });

    const report = runFullAudit(root);
    expect(report.layers).toHaveLength(13);
    expect(report.layers.map((l) => l.id).sort()).toEqual(
      [
        'accessibility',
        'backup',
        'compliance',
        'deployment',
        'environment',
        'error-handling',
        'logging',
        'monitoring',
        'performance',
        'rate-limiting',
        'secrets',
        'security',
        'sessions',
      ].sort(),
    );
    expect(report.passed).toBe(false);
    expect(report.criticalFailures.length).toBeGreaterThan(0);
    for (const layer of report.layers) {
      expect(layer.score).toBeGreaterThanOrEqual(0);
      expect(layer.score).toBeLessThanOrEqual(100);
      for (const f of layer.findings) {
        expect(f.suggestedFix.length).toBeGreaterThan(5);
        expect(['critical', 'warning', 'info']).toContain(f.severity);
      }
    }

    const fixes = generateFixesForReport(report.layers);
    expect(fixes.every((f) => f.requiresHumanApproval === true)).toBe(true);
    const messages = report.layers
      .flatMap((l) => l.findings.filter((f) => f.severity !== 'info').map((f) => f.message));
    expect(fixTemplateCoverage(messages)).toBeGreaterThanOrEqual(0.8);

    const pipeline = await runPipeline(root, 'staging', { humanApproval: false });
    expect(pipeline.deployed).toBe(false);
    expect(pipeline.status.state).toBe('failed');
    expect(CRITICAL_LAYER_IDS.length).toBeGreaterThanOrEqual(5);
  });

  it('passes a hardened sample and awaits human approval before deploy', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conveyor-ok-'));
    writeTree(root, {
      'package.json': '{"name":"ok"}',
      '.gitignore': 'node_modules\n.env\n',
      '.env.example': 'DATABASE_URL=\nAPI_KEY=\n',
      'src/server.ts': `
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
app.use(helmet());
app.use(rateLimit({ windowMs: 60000, max: 100 }));
session({ cookie: { maxAge: 3600000, httpOnly: true, secure: true } });
function publicError(){ return { error: 'Internal error' }; }
app.get('/health', (_r,s)=>s.json({ok:true}));
logger.info('boot');
revokeAllSessions;
backup restore pg_dump disaster recovery;
`,
      'docs/privacy.md': 'GDPR consent and privacy policy.',
      'docs/backup.md': 'Nightly backup and disaster recovery restore drill.',
      '.github/workflows/ci.yml': 'name: ci\non: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n',
      'deploy/rollback.sh': '#!/bin/bash\n# rollback blue-green deploy-atomic\n',
      'src/ui.tsx': '<img alt="logo" aria-label="home" />\n',
    });

    const report = runFullAudit(root);
    expect(report.passed).toBe(true);
    let deployed = false;
    const waiting = await runPipeline(root, 'staging', { humanApproval: false });
    expect(waiting.status.state).toBe('awaiting_approval');
    const approved = await runPipeline(root, 'staging', {
      humanApproval: true,
      deployFn: async () => {
        deployed = true;
      },
    });
    expect(approved.deployed).toBe(true);
    expect(deployed).toBe(true);
    expect(approved.status.state).toBe('passed');
  });
});
