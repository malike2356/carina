import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function raspRoot(): string {
  return path.join(resolveCarinaDataDir(), 'rasp');
}

export function assessmentsPath(): string {
  return path.join(raspRoot(), 'assessments.jsonl');
}

export function responsesPath(): string {
  return path.join(raspRoot(), 'responses.jsonl');
}
