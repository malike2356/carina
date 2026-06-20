import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function complianceRoot(): string {
  return path.join(resolveCarinaDataDir(), 'compliance');
}

export function reportsDir(): string {
  return path.join(complianceRoot(), 'reports');
}

export function dsarDir(): string {
  return path.join(complianceRoot(), 'dsar');
}

export function breachDir(): string {
  return path.join(complianceRoot(), 'breach');
}

export function dataRegistryPath(): string {
  return path.join(complianceRoot(), 'data-registry.json');
}

export function lastCollectionPath(): string {
  return path.join(complianceRoot(), 'last-collection.json');
}
