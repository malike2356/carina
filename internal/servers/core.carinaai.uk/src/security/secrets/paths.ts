import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function secretsRotationRoot(): string {
  return path.join(resolveCarinaDataDir(), 'secrets-rotation');
}

export function policiesPath(): string {
  return path.join(secretsRotationRoot(), 'policies.json');
}

export function registryPath(): string {
  return path.join(secretsRotationRoot(), 'registry.json');
}

export function rotationAuditPath(): string {
  return path.join(secretsRotationRoot(), 'rotation-audit.jsonl');
}

export function schedulesPath(): string {
  return path.join(secretsRotationRoot(), 'schedules.json');
}
