import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { packDir } from '../../config/paths.js';
import { BUILTIN_PACKS_DIR } from '../../skills/pack-loader.js';
import { resolvePackDirectory } from '../../skills/pack-discovery.js';
import { validatePackDir } from '../../skills/hub/validate.js';
import { scanSkillContent } from '../../skills/hub/hub-security-scanner.js';
import type { ProvenanceCheck, ProvenanceVerdict } from './types.js';

type ProvenanceManifest = {
  integrity?: string;
  signature?: string;
  publisher?: string;
  hubVerified?: boolean;
};

const DEFAULT_TRUSTED_PUBLISHERS = ['verlox', 'carina', 'VERLOX', 'Carina'];

function trustedPublishers(): string[] {
  const fromEnv = process.env.CARINA_TRUSTED_PUBLISHERS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_TRUSTED_PUBLISHERS;
}

async function collectTextFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      files.push(...await collectTextFiles(full));
      continue;
    }
    if (/\.(md|ts|js|json|txt|yaml|yml)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function computeDirectoryIntegrity(dir: string): Promise<string> {
  const files = (await collectTextFiles(dir)).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const rel = path.relative(dir, file);
    const content = await fs.readFile(file);
    hash.update(rel);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function readProvenanceSidecar(dir: string): Promise<ProvenanceManifest | null> {
  const candidates = [
    path.join(dir, '.carina-provenance.json'),
    path.join(dir, 'provenance.json'),
  ];
  for (const file of candidates) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as ProvenanceManifest;
    } catch {
      // try next
    }
  }
  return null;
}

async function resolveSkillSource(skillName: string): Promise<string | null> {
  const installed = resolvePackDirectory(skillName);
  if (installed) return installed;
  const packPath = packDir(skillName);
  try {
    await fs.access(path.join(packPath, 'pack.json'));
    return packPath;
  } catch {
    // not installed
  }
  const builtin = path.join(BUILTIN_PACKS_DIR, skillName);
  try {
    await fs.access(path.join(builtin, 'pack.json'));
    return builtin;
  } catch {
    return null;
  }
}

function determineVerdict(input: {
  hashMatch: boolean;
  scannerPassed: boolean;
  signatureVerified: boolean;
  authorTrusted: boolean;
  hubVerified: boolean;
  flags: string[];
  requireHubVerified: boolean;
}): ProvenanceVerdict {
  if (!input.scannerPassed) return 'blocked';
  if (!input.hashMatch && input.flags.includes('integrity_mismatch')) return 'blocked';
  if (input.requireHubVerified && !input.hubVerified) return 'blocked';
  if (!input.authorTrusted || !input.signatureVerified) return 'warning';
  return 'allowed';
}

export type ProvenanceCheckOptions = {
  expectedIntegrity?: string;
  requireHubVerified?: boolean;
};

export async function checkProvenance(
  skillName: string,
  options: ProvenanceCheckOptions = {},
): Promise<ProvenanceCheck> {
  const sourcePath = await resolveSkillSource(skillName);
  if (!sourcePath) {
    return {
      skillName,
      version: 'unknown',
      checks: {
        signatureVerified: false,
        hashMatch: false,
        hubVerified: false,
        authorTrusted: false,
        scannerPassed: false,
      },
      flags: ['not_installed'],
      verdict: 'blocked',
      recommendation: `Install the skill/pack first: carina pack install ${skillName}`,
    };
  }

  const manifest = await validatePackDir(sourcePath);
  const sidecar = await readProvenanceSidecar(sourcePath);
  const computedIntegrity = await computeDirectoryIntegrity(sourcePath);
  const expectedIntegrity = options.expectedIntegrity ?? sidecar?.integrity;
  const hashMatch = !expectedIntegrity || expectedIntegrity === computedIntegrity;

  const files = await collectTextFiles(sourcePath);
  const flags: string[] = [];
  let scannerPassed = true;
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const verdict = await scanSkillContent(content);
    if (!verdict.passed) {
      scannerPassed = false;
      flags.push(...verdict.flags.map((flag) => `${path.basename(file)}:${flag}`));
    }
  }

  const authorTrusted = trustedPublishers().some((publisher) =>
    manifest.author.toLowerCase().includes(publisher.toLowerCase())
    || (sidecar?.publisher ?? '').toLowerCase().includes(publisher.toLowerCase()));

  const signatureVerified = Boolean(sidecar?.signature) || hashMatch;
  const hubVerified = sidecar?.hubVerified === true
    || process.env.CARINA_HUB_VERIFIED_PACKS?.split(',').includes(skillName) === true;

  if (!hashMatch) flags.push('integrity_mismatch');
  if (!authorTrusted) flags.push('author_untrusted');
  if (!hubVerified && options.requireHubVerified) flags.push('hub_unverified');

  const verdict = determineVerdict({
    hashMatch,
    scannerPassed,
    signatureVerified,
    authorTrusted,
    hubVerified,
    flags,
    requireHubVerified: options.requireHubVerified === true,
  });

  return {
    skillName,
    version: manifest.version,
    sourcePath,
    checks: {
      signatureVerified,
      hashMatch,
      hubVerified,
      authorTrusted,
      scannerPassed,
    },
    flags,
    verdict,
    recommendation: verdict === 'allowed'
      ? 'Provenance checks passed.'
      : verdict === 'warning'
        ? 'Review publisher trust and integrity sidecar before production use.'
        : 'Do not install or enable this skill until provenance issues are resolved.',
  };
}

export function formatProvenanceSummary(check: ProvenanceCheck): string {
  const lines = [
    `Provenance ${check.skillName}@${check.version}: ${check.verdict.toUpperCase()}`,
    `signature=${check.checks.signatureVerified} hash=${check.checks.hashMatch} hub=${check.checks.hubVerified} author=${check.checks.authorTrusted} scanner=${check.checks.scannerPassed}`,
  ];
  if (check.flags.length > 0) lines.push(`Flags: ${check.flags.join(', ')}`);
  lines.push(check.recommendation);
  return lines.join('\n');
}

export function shouldBlockProvenance(check: ProvenanceCheck): boolean {
  return check.verdict === 'blocked';
}
