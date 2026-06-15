import { llm } from '../brain/llm.js';
import { addPersistentFact, getPersistentFactsText } from '../memory/persistent-memory.js';
import type { Message } from '../types/index.js';

const EXTRACT_PROMPT = `The operator just corrected the AI agent. Extract their stated preference as a single, direct fact statement.

Format: "Operator prefers X" or "Never do Y when Z" or "Always use A instead of B".

Correction: {correction}

Respond with ONLY the one-line preference statement. If the correction does not contain a clear, extractable preference (e.g. it is just "wrong" or "no"), respond with: none`;

function wordOverlap(a: string, b: string): number {
  const stop = new Set(['the', 'and', 'for', 'not', 'you', 'this', 'that', 'with', 'from', 'when', 'over', 'instead']);
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !stop.has(w)));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !stop.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let hit = 0;
  for (const w of wordsA) if (wordsB.has(w)) hit++;
  return hit / new Set([...wordsA, ...wordsB]).size;
}

export async function learnPreferenceFromCorrection(userMessage: string): Promise<boolean> {
  try {
    const messages: Message[] = [{
      role: 'user',
      content: EXTRACT_PROMPT.replace('{correction}', userMessage.slice(0, 400)),
      timestamp: new Date(),
    }];
    const response = await llm.chatCheap(messages);
    const preference = response.content.trim();
    if (!preference || preference.toLowerCase() === 'none') return false;
    if (preference.length > 200) return false;

    const existing = await getPersistentFactsText('user');
    if (existing) {
      for (const line of existing.split('\n')) {
        if (wordOverlap(preference, line) >= 0.65) return false;
      }
    }

    await addPersistentFact('user', preference);
    return true;
  } catch {
    return false;
  }
}
