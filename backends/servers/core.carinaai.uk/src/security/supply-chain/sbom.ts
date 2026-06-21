import fs from 'node:fs/promises';
import path from 'node:path';
import { parseAllDocuments } from 'yaml';
import type { SBOM, SBOMPackage, SBOMRelationship } from './types.js';

type LockPackage = {
  resolution?: { integrity?: string };
};

function spdxIdForPackage(name: string, version: string): string {
  const safe = `${name}@${version}`.replace(/[^a-zA-Z0-9.-]/g, '-');
  return `SPDXRef-Package-${safe}`;
}

function parseIntegrity(integrity?: string): Array<{ algorithm: string; checksumValue: string }> {
  if (!integrity) return [];
  const [algorithm, value] = integrity.split('-', 2);
  if (!algorithm || !value) return [];
  return [{ algorithm: algorithm.toUpperCase(), checksumValue: value }];
}

function parseLockfilePackages(raw: string): Map<string, LockPackage> {
  const map = new Map<string, LockPackage>();
  for (const doc of parseAllDocuments(raw)) {
    const parsed = doc.toJSON() as { packages?: Record<string, LockPackage> } | null;
    for (const [key, value] of Object.entries(parsed?.packages ?? {})) {
      map.set(key, value ?? {});
    }
  }
  return map;
}

function parseDirectDependencies(raw: string): Array<{ name: string; version: string }> {
  const deps: Array<{ name: string; version: string }> = [];
  for (const doc of parseAllDocuments(raw)) {
    const parsed = doc.toJSON() as {
      importers?: Record<string, {
        dependencies?: Record<string, { version?: string }>;
        devDependencies?: Record<string, { version?: string }>;
      }>;
    } | null;
    const importer = parsed?.importers?.['.'];
    const entries = {
      ...importer?.dependencies,
      ...importer?.devDependencies,
    };
    for (const [name, spec] of Object.entries(entries ?? {})) {
      deps.push({ name, version: String(spec?.version ?? 'unknown') });
    }
  }
  return deps;
}

function findLockEntry(
  lockPackages: Map<string, LockPackage>,
  name: string,
  version: string,
): LockPackage | undefined {
  return lockPackages.get(`${name}@${version}`)
    ?? lockPackages.get(`${name}@${version}()`)
    ?? lockPackages.get(`${name}@/${version}`);
}

export async function generateSbom(projectRoot: string): Promise<SBOM> {
  const pkgPath = path.join(projectRoot, 'package.json');
  const lockPath = path.join(projectRoot, 'pnpm-lock.yaml');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
    name?: string;
    version?: string;
    license?: string;
  };
  const lockRaw = await fs.readFile(lockPath, 'utf8');
  const lockPackages = parseLockfilePackages(lockRaw);
  const directDeps = parseDirectDependencies(lockRaw);

  const created = new Date().toISOString();
  const rootName = pkg.name ?? 'carina';
  const rootVersion = pkg.version ?? '0.0.0';
  const rootId = 'SPDXRef-RootPackage';

  const packages: SBOMPackage[] = [{
    spdxId: rootId,
    name: rootName,
    version: rootVersion,
    downloadLocation: 'NOASSERTION',
    licenseConcluded: pkg.license ?? 'MIT',
    checksums: [],
    externalRefs: [{
      referenceCategory: 'PACKAGE-MANAGER',
      referenceType: 'pnpm',
      referenceLocator: `${rootName}@${rootVersion}`,
    }],
  }];

  const relationships: SBOMRelationship[] = [{
    spdxElementId: 'SPDXRef-DOCUMENT',
    relatedSpdxElement: rootId,
    relationshipType: 'DESCRIBES',
  }];

  const seen = new Set<string>();
  for (const [key, entry] of lockPackages.entries()) {
    const at = key.lastIndexOf('@');
    if (at <= 0) continue;
    const name = key.slice(0, at);
    const version = key.slice(at + 1).replace(/\([^)]*\)$/, '');
    const dedupe = `${name}@${version}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    packages.push({
      spdxId: spdxIdForPackage(name, version),
      name,
      version,
      downloadLocation: 'NOASSERTION',
      licenseConcluded: 'NOASSERTION',
      checksums: parseIntegrity(entry.resolution?.integrity),
      externalRefs: [{
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'pnpm',
        referenceLocator: dedupe,
      }],
    });
  }

  for (const dep of directDeps) {
    const lockEntry = findLockEntry(lockPackages, dep.name, dep.version);
    const version = lockEntry ? dep.version : dep.version;
    const depId = spdxIdForPackage(dep.name, version);
    relationships.push({
      spdxElementId: rootId,
      relatedSpdxElement: depId,
      relationshipType: 'DEPENDS_ON',
    });
    if (!seen.has(`${dep.name}@${version}`)) {
      packages.push({
        spdxId: depId,
        name: dep.name,
        version,
        downloadLocation: 'NOASSERTION',
        licenseConcluded: 'NOASSERTION',
        checksums: parseIntegrity(lockEntry?.resolution?.integrity),
        externalRefs: [{
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'pnpm',
          referenceLocator: `${dep.name}@${version}`,
        }],
      });
    }
  }

  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: 'Carina',
    documentNamespace: `https://carinaai.uk/spdx/${rootName}/${rootVersion}/${created.slice(0, 10)}`,
    creationInfo: {
      created,
      creators: ['Tool: carina-security-supply-chain'],
    },
    packages,
    relationships,
  };
}

export async function writeSbom(projectRoot: string, outputPath: string): Promise<SBOM> {
  const sbom = await generateSbom(projectRoot);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(sbom, null, 2), 'utf8');
  return sbom;
}

export function formatSbomSummary(sbom: SBOM): string {
  return [
    `SBOM ${sbom.name} (${sbom.spdxVersion})`,
    `Packages: ${sbom.packages.length}`,
    `Relationships: ${sbom.relationships.length}`,
    `Namespace: ${sbom.documentNamespace}`,
  ].join('\n');
}
