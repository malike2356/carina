import type { PackSkillInput } from '../packs/property-uk/skills.js';
import { scanForSensitive } from './fixtures.js';
import type { EvalFixture, EvalFixtureInput } from './types.js';

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[email-redacted]' },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[phone-redacted]' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[api-key-redacted]' },
  { pattern: /\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/gi, replacement: '[postcode-redacted]' },
];

export interface UsageExample {
  query: string;
  matchedSkill?: string;
  toolsUsed?: string[];
  outputSummary?: string;
}

export function redactText(text: string): string {
  let out = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function exampleToFixture(
  example: UsageExample,
  index: number,
): EvalFixture {
  const query = redactText(example.query);
  scanForSensitive(query, `derived-fixture-${index}`);

  const assertions: EvalFixture['assertions'] = [];
  if (example.matchedSkill) {
    assertions.push({ type: 'skill_match', skill: example.matchedSkill });
  }
  if (example.toolsUsed?.length) {
    assertions.push({
      type: 'tools_include',
      skill: example.matchedSkill,
      tools: example.toolsUsed,
    });
  }

  if (assertions.length === 0) {
    assertions.push({ type: 'keyword_overlap', min: 0.2 });
  }

  const input: EvalFixtureInput = { query };
  if (example.outputSummary) {
    input.simulateOutput = redactText(example.outputSummary);
  }

  return {
    id: `derived-${index}`,
    description: 'Derived from redacted usage example',
    input,
    assertions,
    tags: ['derived'],
  };
}

export function deriveFixturesFromExamples(examples: UsageExample[]): EvalFixture[] {
  return examples.map((ex, i) => exampleToFixture(ex, i));
}

export function deriveFixturesFromSkills(skills: PackSkillInput[]): EvalFixture[] {
  return skills.map((skill, i) => {
    const trigger = skill.trigger[0] ?? skill.name;
    const query = `Help me with ${trigger}`;
    return {
      id: `auto-${skill.name}`,
      description: `Auto-generated from skill ${skill.name}`,
      input: { query, keywords: skill.trigger.slice(0, 3) },
      assertions: [
        { type: 'skill_match', skill: skill.name },
        { type: 'tools_include', skill: skill.name, tools: skill.toolsUsed.slice(0, 1) },
      ],
      tags: ['auto-generated'],
    };
  });
}

export function buildEvalDefinitionFromPack(
  packName: string,
  skills: PackSkillInput[],
): { version: string; pack: string; thresholds: object; fixtures: EvalFixture[] } {
  return {
    version: '1',
    pack: packName,
    thresholds: {
      minPassRate: 0.85,
      maxMeanLatencyMs: 100,
    },
    fixtures: deriveFixturesFromSkills(skills),
  };
}
