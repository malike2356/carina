export type VerbSet = 'default' | 'playful' | 'scout' | 'minimal';

export const VERB_SETS: Record<VerbSet, string[]> = {
  default: ['Thinking', 'Working', 'Creating', 'Processing'],
  playful: ['Conjuring', 'Brewing', 'Cooking', 'Weaving'],
  scout: ['Scanning', 'Patrolling', 'Guarding', 'Monitoring'],
  minimal: ['Processing', 'Running', 'Waiting'],
};

export function pickVerb(set: VerbSet, tick: number): string {
  const verbs = VERB_SETS[set];
  return verbs[tick % verbs.length] ?? verbs[0]!;
}
