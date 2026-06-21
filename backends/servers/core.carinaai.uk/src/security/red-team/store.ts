import fs from 'node:fs/promises';
import type { RedTeamExercise, RedTeamReport, RedTeamResult } from './types.js';
import { DEFAULT_RED_TEAM_EXERCISES } from './exercises.js';
import { exercisesPath, redTeamRoot, resultsPath, schedulePath } from './paths.js';

export async function appendResult(result: RedTeamResult): Promise<void> {
  await fs.mkdir(redTeamRoot(), { recursive: true });
  await fs.appendFile(resultsPath(), `${JSON.stringify(result)}\n`, { mode: 0o600 });
}

export async function readResults(limit = 100): Promise<RedTeamResult[]> {
  try {
    const raw = await fs.readFile(resultsPath(), 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).map(
      (line) => JSON.parse(line) as RedTeamResult,
    );
  } catch {
    return [];
  }
}

export async function loadExercises(): Promise<RedTeamExercise[]> {
  try {
    const raw = JSON.parse(await fs.readFile(exercisesPath(), 'utf8')) as { exercises?: RedTeamExercise[] };
    if (Array.isArray(raw.exercises) && raw.exercises.length > 0) return raw.exercises;
  } catch {
    // fall through
  }
  return DEFAULT_RED_TEAM_EXERCISES.map((row) => ({ ...row, results: [] }));
}

export async function saveExercises(exercises: RedTeamExercise[]): Promise<void> {
  await fs.mkdir(redTeamRoot(), { recursive: true });
  await fs.writeFile(exercisesPath(), JSON.stringify({ exercises }, null, 2), { mode: 0o600 });
}

export async function markExerciseRun(exerciseId: string, result: RedTeamResult): Promise<void> {
  const exercises = await loadExercises();
  const exercise = exercises.find((row) => row.id === exerciseId);
  if (!exercise) return;
  exercise.lastRun = result.timestamp;
  exercise.results = [...(exercise.results ?? []), result].slice(-20);
  await saveExercises(exercises);
  await fs.writeFile(
    schedulePath(),
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      lastRuns: Object.fromEntries(
        exercises.map((row) => [row.id, row.lastRun ? new Date(row.lastRun).toISOString() : null]),
      ),
    }, null, 2),
    { mode: 0o600 },
  );
}

export async function buildLatestReport(): Promise<RedTeamReport> {
  const results = await readResults(50);
  const latestByExercise = new Map<string, RedTeamResult>();
  for (const result of results) {
    latestByExercise.set(result.exerciseId, result);
  }
  const unresolvedGaps = [...latestByExercise.values()].flatMap((row) => row.gaps);
  return {
    generatedAt: new Date().toISOString(),
    exercisesRun: latestByExercise.size,
    results: [...latestByExercise.values()],
    unresolvedGaps,
  };
}

export async function _resetRedTeamStoreForTests(): Promise<void> {
  try {
    await fs.rm(redTeamRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
