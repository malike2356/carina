import os from 'node:os';
import path from 'node:path';

function carinaHome(): string {
  return process.env.CARINA_HOME?.trim() || path.join(os.homedir(), '.carina');
}

export function enterpriseSecurityRoot(): string {
  return path.join(carinaHome(), 'enterprise-security');
}

export function immutableAuditPath(): string {
  return path.join(enterpriseSecurityRoot(), 'immutable-audit.jsonl');
}

export function merkleRootsPath(): string {
  return path.join(enterpriseSecurityRoot(), 'merkle-roots.json');
}

export function drStatePath(): string {
  return path.join(enterpriseSecurityRoot(), 'dr-state.json');
}

export function soc2PackagesDir(): string {
  return path.join(enterpriseSecurityRoot(), 'soc2-packages');
}
