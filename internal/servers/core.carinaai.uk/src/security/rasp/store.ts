import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { RASPSignal, ThreatAssessment } from './types.js';
import { assessmentsPath, raspRoot, responsesPath } from './paths.js';

export type RaspResponseRecord = {
  assessmentId: string;
  action: string;
  description: string;
  timestamp: number;
  sessionId: string;
  threatScore: number;
};

export async function appendAssessment(assessment: ThreatAssessment): Promise<void> {
  const file = assessmentsPath();
  await fs.mkdir(raspRoot(), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(assessment)}\n`, { mode: 0o600 });
}

export async function appendRaspResponse(record: RaspResponseRecord): Promise<void> {
  const file = responsesPath();
  await fs.mkdir(raspRoot(), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
}

export async function readAssessments(limit = 50): Promise<ThreatAssessment[]> {
  try {
    const raw = await fs.readFile(assessmentsPath(), 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).map(
      (line) => JSON.parse(line) as ThreatAssessment,
    );
  } catch {
    return [];
  }
}

export async function getAssessment(id: string): Promise<ThreatAssessment | null> {
  const rows = await readAssessments(500);
  return rows.find((row) => row.id === id) ?? null;
}

export function assignSignalId(signal: RASPSignal): RASPSignal {
  return {
    ...signal,
    id: signal.id ?? randomUUID(),
  };
}

export async function _resetRaspStoreForTests(): Promise<void> {
  try {
    await fs.rm(raspRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
