import fs from 'node:fs';
import path from 'node:path';

export type Severity = 'critical' | 'warning' | 'info';

export type Finding = {
  severity: Severity;
  message: string;
  file?: string;
  suggestedFix: string;
};

export type LayerId =
  | 'security'
  | 'error-handling'
  | 'environment'
  | 'logging'
  | 'monitoring'
  | 'rate-limiting'
  | 'secrets'
  | 'sessions'
  | 'accessibility'
  | 'compliance'
  | 'performance'
  | 'backup'
  | 'deployment';

export type LayerResult = {
  id: LayerId;
  name: string;
  score: number;
  critical: boolean;
  findings: Finding[];
  passed: boolean;
};

export type AuditReport = {
  projectPath: string;
  checkedAt: string;
  layers: LayerResult[];
  overallScore: number;
  passed: boolean;
  threshold: number;
  criticalFailures: LayerResult[];
  summary: string;
};

export type FixProposal = {
  layerId: LayerId;
  findingMessage: string;
  title: string;
  patchOrConfig: string;
  requiresHumanApproval: true;
  confidence: number;
};

export type PipelineStatus = {
  state: 'idle' | 'auditing' | 'fixing' | 'validating' | 'awaiting_approval' | 'deploying' | 'passed' | 'failed';
  targetEnv: string;
  report?: AuditReport;
  fixes?: FixProposal[];
  message: string;
  updatedAt: string;
};

export type AuditContext = {
  root: string;
  files: string[];
  readText: (relOrAbs: string) => string | null;
};

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
]);

export function walkProjectFiles(root: string, maxFiles = 4000): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length && out.length < maxFiles) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && ent.name !== '.env' && ent.name !== '.gitignore' && ent.name !== '.github' && ent.name !== '.env.example') {
        if (ent.name === '.github') {
          // keep
        } else if (!['.env', '.gitignore', '.env.example', '.pre-commit-config.yaml'].includes(ent.name)) {
          continue;
        }
      }
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '.github' || !ent.name.startsWith('.')) stack.push(full);
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

export function createAuditContext(projectPath: string): AuditContext {
  const root = path.resolve(projectPath);
  const files = walkProjectFiles(root);
  return {
    root,
    files,
    readText: (relOrAbs) => {
      const full = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs);
      try {
        return fs.readFileSync(full, 'utf8');
      } catch {
        return null;
      }
    },
  };
}

export function rel(ctx: AuditContext, file: string): string {
  return path.relative(ctx.root, file) || file;
}

export function scoreFromFindings(findings: Finding[], criticalLayer: boolean): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'critical') score -= criticalLayer ? 35 : 25;
    else if (f.severity === 'warning') score -= 12;
    else score -= 4;
  }
  return Math.max(0, Math.min(100, score));
}

export function layerPassed(score: number, threshold: number): boolean {
  return score >= threshold;
}

export const CRITICAL_LAYER_IDS: LayerId[] = [
  'security',
  'error-handling',
  'environment',
  'secrets',
  'sessions',
  'deployment',
];

export const DEFAULT_THRESHOLD = 80;
