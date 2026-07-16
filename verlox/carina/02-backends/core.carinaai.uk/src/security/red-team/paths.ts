import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function redTeamRoot(): string {
  return path.join(resolveCarinaDataDir(), 'red-team');
}

export function resultsPath(): string {
  return path.join(redTeamRoot(), 'results.jsonl');
}

export function exercisesPath(): string {
  return path.join(redTeamRoot(), 'exercises.json');
}

export function detectionRulesPath(): string {
  return path.join(redTeamRoot(), 'detection-rules.json');
}

export function schedulePath(): string {
  return path.join(redTeamRoot(), 'schedule.json');
}
