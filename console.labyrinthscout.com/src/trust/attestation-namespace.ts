export const LABYRINTH_SCOUT_NAMESPACE = 'labyrinth-scout.v1' as const;

export const LABYRINTH_SCOUT_TAGS = {
  runtimeClean: 'runtime.clean',
  securitySummary: 'security.summary',
} as const;

export interface LabyrinthScoutAttestationFields {
  securityScore: number;
  runtimeHours: number;
  threatsDetected: number;
  injectionBlocks: number;
  sandboxViolations: number;
}

export const LABYRINTH_SCOUT_SCHEMA = {
  namespace: LABYRINTH_SCOUT_NAMESPACE,
  name: 'Labyrinth Scout Security Attestation',
  description:
    'Verifiable security posture from Labyrinth Scout SIEM: risk score, runtime hours, threats, injection blocks, sandbox violations.',
  allowedTags: [
    LABYRINTH_SCOUT_TAGS.runtimeClean,
    LABYRINTH_SCOUT_TAGS.securitySummary,
  ],
  minScore: 0,
  maxScore: 100,
} as const;

export function buildAttestationComment(fields: LabyrinthScoutAttestationFields): string {
  return JSON.stringify({
    securityScore: fields.securityScore,
    runtimeHours: fields.runtimeHours,
    threatsDetected: fields.threatsDetected,
    injectionBlocks: fields.injectionBlocks,
    sandboxViolations: fields.sandboxViolations,
    schema: LABYRINTH_SCOUT_NAMESPACE,
    version: 1,
  });
}

export function securityScoreFromRisk(riskScore: number): number {
  return Math.min(100, Math.max(0, 100 - riskScore));
}
