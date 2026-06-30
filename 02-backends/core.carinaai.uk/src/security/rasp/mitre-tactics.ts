import type { RASPSignal } from './types.js';

export type MitreTactic =
  | 'TA0001'
  | 'TA0002'
  | 'TA0003'
  | 'TA0005'
  | 'TA0006'
  | 'TA0009'
  | 'TA0010'
  | 'TA0043';

const PATTERN_TACTIC_MAP: Record<string, MitreTactic> = {
  'INJ-D01': 'TA0009',
  'INJ-D02': 'TA0010',
  'INJ-D03': 'TA0006',
  'INJ-J01': 'TA0002',
  'INJ-J03': 'TA0006',
  'INJ-O01': 'TA0001',
  'INJ-K01': 'TA0003',
};

const SOURCE_TACTIC_MAP: Partial<Record<RASPSignal['source'], MitreTactic>> = {
  prompt_guard: 'TA0001',
  tool_sequence: 'TA0002',
  egress_filter: 'TA0010',
  honeypot: 'TA0006',
  trust_state: 'TA0005',
  anomaly: 'TA0043',
};

const PROGRESSION_ANCHOR_TACTICS = new Set<MitreTactic>(['TA0001', 'TA0009', 'TA0010']);

export function resolvePatternId(signal: RASPSignal): string | undefined {
  if (signal.patternId) return signal.patternId;
  const fromDetails = signal.context.details.patternId;
  if (typeof fromDetails === 'string' && fromDetails) return fromDetails;
  const patterns = signal.context.details.patterns;
  if (Array.isArray(patterns) && typeof patterns[0] === 'string') return patterns[0];
  return undefined;
}

export function resolveMitreTactic(signal: RASPSignal): MitreTactic | undefined {
  if (signal.mitreTactic) return signal.mitreTactic;
  const patternId = resolvePatternId(signal);
  if (patternId && PATTERN_TACTIC_MAP[patternId]) {
    return PATTERN_TACTIC_MAP[patternId];
  }
  return SOURCE_TACTIC_MAP[signal.source];
}

export function enrichSignalWithMitreTactic(signal: RASPSignal): RASPSignal {
  const mitreTactic = resolveMitreTactic(signal);
  if (!mitreTactic) return signal;
  return { ...signal, mitreTactic };
}

export function detectTacticProgression(signals: RASPSignal[]): boolean {
  const tactics = new Set(
    signals
      .map((row) => resolveMitreTactic(row))
      .filter((row): row is MitreTactic => Boolean(row)),
  );
  if (tactics.size < 3) return false;
  for (const tactic of tactics) {
    if (PROGRESSION_ANCHOR_TACTICS.has(tactic)) return true;
  }
  return false;
}
