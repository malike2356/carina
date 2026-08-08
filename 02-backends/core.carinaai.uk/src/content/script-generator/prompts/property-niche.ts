import type { PropertyNicheDefinition } from '../niches.js';

export interface NichePromptInput {
  niche: PropertyNicheDefinition;
  location: string;
  theme: string;
  dayIndex: number;
  primaryKeyword: string;
}

/**
 * Builds the natural-language prompt used when a real LLM call is wired in
 * for script generation. The deterministic generator in generator.ts is the
 * fallback implementation used today (see docs/features gaps); this prompt
 * template exists so an LLM provider can be attached without redesigning the
 * pipeline.
 */
export function buildNichePrompt(input: NichePromptInput): string {
  return [
    `Write a 3 to 5 minute faceless YouTube video script for a UK property channel.`,
    `Niche: ${input.niche.label}. Location: ${input.location}.`,
    `Weekly theme: ${input.theme}. Primary keyword: ${input.primaryKeyword}.`,
    `Structure: a hook in the first 15 seconds, a body with 3 to 5 clear points, and a call to action.`,
    `Tone: direct, calm, informative, no hype and no unverifiable claims.`,
    `Never mention pricing, contact details, or presenter appearance; this is a faceless channel using property images, text overlays, and voiceover only.`,
    `Day ${input.dayIndex + 1} of a 365 day content calendar; keep the angle distinct from prior days on the same theme.`,
  ].join('\n');
}
