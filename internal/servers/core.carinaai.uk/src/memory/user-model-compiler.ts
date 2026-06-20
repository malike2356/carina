import { callAuxiliaryModel } from '../brain/auxiliary-client.js';
import { userIntelligenceEnabled } from './user-model.js';
import {
  getFacts,
  getUserModelMeta,
  saveCompiledSummary,
} from './user-model-store.js';

const INJECTION_MIN_CONFIDENCE = 0.5;

function buildCompilePrompt(factLines: string): string {
  return `Compile the following observations about a user into a concise 5-10 sentence profile
that can be injected into an AI assistant's system prompt.

Write in second person addressing the AI: "The user is...", "They prefer...", etc.
Focus on information that would make responses more relevant and better-tuned.

User observations:
${factLines}

Write the profile:`;
}

export async function compileUserModel(profileId: string): Promise<string> {
  if (!userIntelligenceEnabled()) return '';

  const facts = await getFacts(profileId, { minConfidence: 0.6 });
  if (facts.length === 0) return '';

  const factLines = facts.map((f) => `[${f.category}] ${f.fact}`).join('\n');

  try {
    return await callAuxiliaryModel('userModeling', buildCompilePrompt(factLines));
  } catch {
    return 'User profile based on past conversations:\n'
      + facts.slice(0, 10).map((f) => `- ${f.fact}`).join('\n');
  }
}

export async function compileAndStoreUserModel(profileId: string): Promise<string> {
  const summary = await compileUserModel(profileId);
  if (summary.trim()) {
    await saveCompiledSummary(profileId, summary.trim());
  }
  return summary.trim();
}

export async function loadUserIntelligenceContext(profileId: string): Promise<string> {
  if (!userIntelligenceEnabled()) return '';

  const facts = await getFacts(profileId, { minConfidence: INJECTION_MIN_CONFIDENCE });
  if (facts.length === 0) return '';

  const meta = await getUserModelMeta(profileId);
  const summary = meta?.compiledSummary?.trim();
  if (summary) {
    return `## User Intelligence (learned from past conversations)\n${summary}`;
  }

  return `## User Intelligence (learned from past conversations)\n`
    + 'User profile based on past conversations:\n'
    + facts.slice(0, 10).map((f) => `- ${f.fact}`).join('\n');
}
