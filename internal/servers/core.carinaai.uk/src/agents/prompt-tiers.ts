export type PromptTier = 'stable' | 'context' | 'volatile';

export type PromptTierParts = {
  stable: string[];
  context: string[];
  volatile: string[];
};

const TIER_LABELS: Record<PromptTier, string> = {
  stable: 'STABLE (identity, tool guidance; cache-friendly)',
  context: 'CONTEXT (session/workspace overlays)',
  volatile: 'VOLATILE (memory, verification, turn metadata)',
};

export function emptyPromptTiers(): PromptTierParts {
  return { stable: [], context: [], volatile: [] };
}

export function pushPromptTier(
  tiers: PromptTierParts,
  tier: PromptTier,
  ...parts: Array<string | null | undefined | false>
): void {
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    const trimmed = part.trim();
    if (trimmed) tiers[tier].push(trimmed);
  }
}

export function joinPromptTiers(tiers: PromptTierParts, opts?: { labelTiers?: boolean }): string {
  const labelTiers = opts?.labelTiers ?? false;
  const sections: string[] = [];

  for (const tier of ['stable', 'context', 'volatile'] as const) {
    if (tiers[tier].length === 0) continue;
    const body = tiers[tier].join('\n\n---\n\n');
    if (labelTiers) {
      sections.push(`## ${TIER_LABELS[tier]}\n\n${body}`);
    } else {
      sections.push(body);
    }
  }

  return sections.join('\n\n---\n\n');
}

export function buildSessionMetadataLine(opts: {
  sessionId: string;
  provider?: string;
  model?: string;
  platform?: string;
}): string {
  const parts = [
    `Session: ${opts.sessionId}`,
    opts.provider ? `Provider: ${opts.provider}` : null,
    opts.model ? `Model: ${opts.model}` : null,
    opts.platform ? `Surface: ${opts.platform}` : null,
    `Timestamp: ${new Date().toISOString()}`,
  ].filter(Boolean);
  return parts.join(' | ');
}
