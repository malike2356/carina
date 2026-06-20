import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function forensicsRoot(): string {
  return path.join(resolveCarinaDataDir(), 'forensics');
}

export function incidentsLogPath(): string {
  return path.join(forensicsRoot(), 'incidents.jsonl');
}

export function custodyLogPath(): string {
  return path.join(forensicsRoot(), 'custody.jsonl');
}

export function playbookExecutionsPath(): string {
  return path.join(forensicsRoot(), 'playbook-executions.jsonl');
}

export function snapshotPath(snapshotId: string): string {
  return path.join(forensicsRoot(), 'snapshots', `${snapshotId}.json`);
}

export function timelinePath(incidentId: string): string {
  return path.join(forensicsRoot(), 'timeline', `${incidentId}.json`);
}

export function exportDir(incidentId: string): string {
  return path.join(forensicsRoot(), 'exports', incidentId);
}

export function artifactDir(snapshotId: string): string {
  return path.join(forensicsRoot(), 'artifacts', snapshotId);
}
