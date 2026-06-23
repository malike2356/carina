import { jaccardSimilarity } from '../store.js';
import type { PackSkillInput } from '../pack-types.js';
import { extractEvalKeywords } from './keywords.js';

export interface MatchedSkill {
  name: string;
  score: number;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
}

function scoreSkill(skill: PackSkillInput, keywords: string[], queryLower: string): number {
  let score = 0;
  for (const trigger of skill.trigger) {
    const t = trigger.toLowerCase();
    if (queryLower.includes(t)) {
      score += t.includes(' ') ? 3 : 2;
    }
    for (const kw of keywords) {
      if (t === kw || t.includes(kw) || kw.includes(t)) {
        score += 1;
      }
    }
  }
  const overlap = jaccardSimilarity(keywords, skill.trigger);
  score += overlap * 5;
  return score;
}

export function matchSkillsInMemory(
  skills: PackSkillInput[],
  query: string,
  explicitKeywords?: string[],
): MatchedSkill[] {
  const keywords = explicitKeywords?.length
    ? explicitKeywords.map((k) => k.toLowerCase())
    : extractEvalKeywords(query);
  const queryLower = query.toLowerCase();

  const scored = skills
    .map((skill) => ({
      name: skill.name,
      score: scoreSkill(skill, keywords, queryLower),
      description: skill.description,
      trigger: skill.trigger,
      steps: skill.steps,
      toolsUsed: skill.toolsUsed,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}
