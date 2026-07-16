export type BootstrapTier = 'identity' | 'context' | 'volatile';

export type BootstrapMode = 'full' | 'minimal';

export type BootstrapFileSpec = {
  name: string;
  tier: BootstrapTier;
  label: string;
  note?: string;
  minimal: boolean;
};

/** One-shot first-run file; consumed by runBootstrapIfPresent, never injected each turn. */
export const BOOTSTRAP_ONE_SHOT_FILE = 'BOOTSTRAP.md';

/**
 * Workspace bootstrap set (agent workspace initialization pattern).
 * Load order: identity (stable) -> context (session) -> volatile (runtime).
 */
export const BOOTSTRAP_FILE_SPECS: BootstrapFileSpec[] = [
  {
    name: 'SOUL.md',
    tier: 'identity',
    label: 'Voice and tone',
    note: 'How you speak. Editable operator voice; layers on the default Carina identity.',
    minimal: false,
  },
  {
    name: 'IDENTITY.md',
    tier: 'identity',
    label: 'Self-definition',
    note: 'Who you are on this install (name, vibe, role).',
    minimal: false,
  },
  {
    name: 'AGENTS.md',
    tier: 'context',
    label: 'Operating rules',
    note: 'Workspace-specific rules and conventions.',
    minimal: true,
  },
  {
    name: 'TOOLS.md',
    tier: 'context',
    label: 'Tool usage notes',
    note: 'How to use tools in this environment. Not tool configuration.',
    minimal: true,
  },
  {
    name: 'USER.md',
    tier: 'volatile',
    label: 'Operator profile',
    note: 'Hand-authored facts about the operator. Learned memories stay in the memory store.',
    minimal: false,
  },
  {
    name: 'MEMORY.md',
    tier: 'volatile',
    label: 'Curated workspace memory',
    note: 'Durable summary notes for this workspace, not daily logs.',
    minimal: false,
  },
  {
    name: 'HEARTBEAT.md',
    tier: 'volatile',
    label: 'Periodic check-in guidance',
    note: 'What to check on heartbeat/cron runs. Stay quiet when nothing changed.',
    minimal: false,
  },
  {
    name: 'DREAMS.md',
    tier: 'volatile',
    label: 'REM promotion review queue',
    note: 'Pending short-term to long-term memory promotions.',
    minimal: false,
  },
  {
    name: 'SHARED_MEMORY.md',
    tier: 'volatile',
    label: 'Cross-agent shared memory',
    note: 'Facts synced via agent-sync.',
    minimal: false,
  },
];

export function bootstrapSpecsForMode(mode: BootstrapMode): BootstrapFileSpec[] {
  if (mode === 'minimal') {
    return BOOTSTRAP_FILE_SPECS.filter((spec) => spec.minimal);
  }
  return BOOTSTRAP_FILE_SPECS;
}

export function formatBootstrapHeader(spec: BootstrapFileSpec): string {
  const lines = [`# ${spec.label} (${spec.name})`, `Tier: ${spec.tier}`];
  if (spec.note) lines.push(spec.note);
  return lines.join('\n');
}

export const BOOTSTRAP_TIER_ORDER: BootstrapTier[] = ['identity', 'context', 'volatile'];
