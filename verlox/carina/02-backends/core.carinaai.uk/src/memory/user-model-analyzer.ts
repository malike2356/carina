import crypto from 'node:crypto';
import { callAuxiliaryModel } from '../brain/auxiliary-client.js';
import { userIntelligenceEnabled } from './user-model.js';
import { incrementConversationCount, saveFact } from './user-model-store.js';
import { compileAndStoreUserModel } from './user-model-compiler.js';
import type { UserFactCategory } from './user-model.js';
import { isUserFactCategory } from './user-model.js';

export interface ParsedUserFact {
  category: UserFactCategory;
  fact: string;
  confidence: number;
}

export function buildAnalysisPrompt(transcript: string): string {
  return `You are analyzing a conversation to extract facts about the user for personalization.

Conversation:
${transcript}

Extract factual observations about the user. Focus on:
- Expertise level and domain knowledge
- Communication preferences (how they like responses formatted)
- Goals and what they're trying to achieve
- Contextual facts (location, portfolio size, budget)
- Observed behavioral patterns
- Things they seem to misunderstand or miss

Return a JSON array of facts. Each fact:
{
  "category": "expertise|preference|goal|context|behavior|blind_spot|constraint",
  "fact": "concise factual statement about the user",
  "confidence": 0.0-1.0
}

Return only facts you are confident about from THIS conversation.
Return an empty array if no new facts are apparent.
Return JSON only, no other text.`;
}

export function parseAnalysisFacts(raw: string): ParsedUserFact[] {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) return [];

  const facts: ParsedUserFact[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const category = String(row.category ?? '').trim();
    const fact = String(row.fact ?? '').trim();
    if (!category || !fact || !isUserFactCategory(category)) continue;
    const confidenceRaw = Number(row.confidence ?? 0.7);
    const confidence = Math.min(Math.max(Number.isFinite(confidenceRaw) ? confidenceRaw : 0.7, 0), 1);
    facts.push({ category, fact, confidence });
  }
  return facts;
}

export async function analyzeConversation(
  profileId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  if (!userIntelligenceEnabled()) return;

  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length < 2) return;

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')
    .slice(0, 8000);

  try {
    const raw = await callAuxiliaryModel('userModeling', buildAnalysisPrompt(transcript));
    const facts = parseAnalysisFacts(raw);
    if (facts.length === 0) return;

    for (const item of facts) {
      await saveFact({
        id: crypto.randomUUID(),
        profileId,
        category: item.category,
        fact: item.fact,
        confidence: item.confidence,
        observedAt: new Date(),
        conversationId,
      });
    }

    await incrementConversationCount(profileId);
    await compileAndStoreUserModel(profileId);
  } catch (err) {
    console.warn('[user-intelligence] Analysis failed (non-fatal):', err);
  }
}
