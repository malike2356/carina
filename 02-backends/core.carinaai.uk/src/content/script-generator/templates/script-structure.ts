import type { PropertyNicheDefinition } from '../niches.js';

export interface ScriptSection {
  label: 'hook' | 'body' | 'cta';
  text: string;
  approxSeconds: number;
}

export interface StructuredScript {
  sections: ScriptSection[];
  fullText: string;
  estimatedDurationSeconds: number;
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length]!;
}

function statForIndex(dayIndex: number): string {
  const stats = ['7.2%', '11%', '18%', '2.4x', '£312 a month', '9 percentage points', '3 years faster'];
  return pick(stats, dayIndex);
}

function buildBodyPoints(niche: PropertyNicheDefinition, theme: string, location: string, dayIndex: number): string[] {
  const angle = pick(
    [
      `First, understand why ${theme.toLowerCase()} matters for ${location} right now.`,
      `Start with the numbers: what ${theme.toLowerCase()} looks like in ${location} this quarter.`,
      `The most common mistake investors make with ${theme.toLowerCase()} in ${location}.`,
    ],
    dayIndex,
  );
  return [
    angle,
    `Next, walk through the practical steps for ${niche.label.toLowerCase()} in ${location}, from research to decision.`,
    `Then, look at the risk side: what could go wrong and how to plan around it.`,
    `Finally, a real example from ${location} that shows how ${theme.toLowerCase()} plays out in practice.`,
  ];
}

/** Deterministic 3-5 minute script builder (hook, body, call to action). */
export function buildScriptStructure(input: {
  niche: PropertyNicheDefinition;
  location: string;
  theme: string;
  dayIndex: number;
}): StructuredScript {
  const { niche, location, theme, dayIndex } = input;
  const hookTemplate = pick(niche.hookTemplates, dayIndex);
  const ctaTemplate = pick(niche.ctaTemplates, dayIndex);
  const hookText = hookTemplate
    .replace('{location}', location)
    .replace('{stat}', statForIndex(dayIndex));

  const bodyPoints = buildBodyPoints(niche, theme, location, dayIndex);
  const bodyText = bodyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n');

  const sections: ScriptSection[] = [
    { label: 'hook', text: hookText, approxSeconds: 15 },
    { label: 'body', text: bodyText, approxSeconds: 180 },
    { label: 'cta', text: ctaTemplate, approxSeconds: 15 },
  ];

  const fullText = [
    `[HOOK]\n${hookText}`,
    `[BODY]\n${bodyText}`,
    `[CALL TO ACTION]\n${ctaTemplate}`,
  ].join('\n\n');

  return {
    sections,
    fullText,
    estimatedDurationSeconds: sections.reduce((sum, s) => sum + s.approxSeconds, 0),
  };
}
