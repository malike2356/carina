import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type CertificationLevel = 'built-on-carina' | 'powered-by-carina' | 'enterprise-supported';

export type CertificationCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: 'required' | 'recommended';
  detail: string;
};

export type CertificationReport = {
  level: CertificationLevel;
  generatedAt: string;
  projectPath: string;
  passed: boolean;
  score: number;
  checks: CertificationCheck[];
  nextSteps: string[];
};

const KERNEL_IMPORT_PATTERNS = [
  /from ['"]@verlox\/carina-core/,
  /from ['"].*carina.*router/,
  /carina (gateway|web|doctor)/i,
];

const FORBIDDEN_BOUNDARY_PATTERNS = [
  /ops\.carinaai\.uk/,
  /console\.labyrinthscout\.com/,
];

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.carina'].includes(entry.name)) continue;
      walkFiles(full, acc);
    } else if (/\.(ts|tsx|js|json|md)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function readTextSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function evaluateBuiltOnCarina(projectPath: string): CertificationReport {
  const resolved = path.resolve(projectPath);
  const checks: CertificationCheck[] = [];
  const pkgPath = path.join(resolved, 'package.json');
  const packJsonPath = path.join(resolved, 'pack.json');
  const readmePath = path.join(resolved, 'README.md');

  const pkgRaw = readTextSafe(pkgPath);
  let hasKernelDep = false;
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string>; scripts?: Record<string, string> };
      hasKernelDep = Boolean(
        pkg.dependencies?.['@verlox/carina-core']
        || pkg.dependencies?.['carina-agent']
        || Object.keys(pkg.scripts ?? {}).some((k) => /carina/i.test(k)),
      );
    } catch {
      // ignore
    }
  }

  const isPack = fs.existsSync(packJsonPath);
  let packValid = false;
  if (isPack) {
    try {
      const manifest = JSON.parse(readTextSafe(packJsonPath)) as { name?: string; author?: string; description?: string };
      packValid = Boolean(manifest.name && manifest.author && manifest.description);
    } catch {
      packValid = false;
    }
  }

  const sourceFiles = walkFiles(resolved).slice(0, 200);
  let kernelIntegration = hasKernelDep;
  let boundaryViolation = false;
  for (const file of sourceFiles) {
    const text = readTextSafe(file);
    if (!kernelIntegration && KERNEL_IMPORT_PATTERNS.some((re) => re.test(text))) {
      kernelIntegration = true;
    }
    if (FORBIDDEN_BOUNDARY_PATTERNS.some((re) => re.test(text))) {
      boundaryViolation = true;
    }
  }

  checks.push({
    id: 'kernel.integration',
    label: 'Carina kernel integration',
    passed: kernelIntegration || isPack,
    severity: 'required',
    detail: kernelIntegration
      ? 'Carina kernel dependency or integration detected'
      : isPack
        ? 'Domain pack project (pack.json present)'
        : 'Add @verlox/carina-core or integrate carina gateway routes',
  });

  checks.push({
    id: 'pack.manifest',
    label: 'Domain pack manifest (pack projects)',
    passed: !isPack || packValid,
    severity: 'required',
    detail: isPack
      ? (packValid ? 'pack.json has name, author, description' : 'pack.json missing required fields')
      : 'Not a pack project (skipped)',
  });

  checks.push({
    id: 'kernel.boundary',
    label: 'Commercial boundary respect',
    passed: !boundaryViolation,
    severity: 'required',
    detail: boundaryViolation
      ? 'Found imports referencing private ops/scout server paths'
      : 'No forbidden commercial boundary imports',
  });

  const readme = readTextSafe(readmePath);
  checks.push({
    id: 'docs.attribution',
    label: 'Public attribution',
    passed: /carina/i.test(readme) || /built on carina|powered by carina/i.test(readme),
    severity: 'recommended',
    detail: readme
      ? (/carina/i.test(readme) ? 'README mentions Carina' : 'Add Carina attribution to README')
      : 'README.md not found',
  });

  const scoutReady = process.env.LABYRINTH_ENABLED === 'true' || /scout|labyrinth/i.test(readme);
  checks.push({
    id: 'security.scout',
    label: 'Scout security path (recommended)',
    passed: scoutReady,
    severity: 'recommended',
    detail: scoutReady
      ? 'Scout integration documented or LABYRINTH_ENABLED=true'
      : 'Document Scout integration for production trust claim',
  });

  const required = checks.filter((c) => c.severity === 'required');
  const passedRequired = required.every((c) => c.passed);
  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);

  const nextSteps: string[] = [];
  for (const check of checks.filter((c) => !c.passed)) {
    nextSteps.push(check.detail);
  }
  if (passedRequired) {
    nextSteps.push(`Apply for badge at ${config.product.supportEmail} with this report (--json)`);
  }

  return {
    level: 'built-on-carina',
    generatedAt: new Date().toISOString(),
    projectPath: resolved,
    passed: passedRequired,
    score,
    checks,
    nextSteps,
  };
}

export function evaluatePoweredByCarina(projectPath: string): CertificationReport {
  const base = evaluateBuiltOnCarina(projectPath);
  const runtimeCheck: CertificationCheck = {
    id: 'runtime.carina_home',
    label: 'CARINA_HOME or active deployment',
    passed: Boolean(process.env.CARINA_HOME) || fs.existsSync(path.join(path.resolve(projectPath), '.carina')),
    severity: 'required',
    detail: 'Production Carina runtime directory or CARINA_HOME configured',
  };
  const checks = [...base.checks, runtimeCheck];
  const required = checks.filter((c) => c.severity === 'required');
  return {
    ...base,
    level: 'powered-by-carina',
    checks,
    passed: required.every((c) => c.passed),
    score: Math.round((checks.filter((c) => c.passed).length / checks.length) * 100),
  };
}
