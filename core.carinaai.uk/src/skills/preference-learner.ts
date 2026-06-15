import { llm } from '../brain/llm.js';
import {
  addPersistentFact,
  getPersistentFactsText,
  replacePersistentFact,
} from '../memory/persistent-memory.js';
import { appendLearningEvent } from './learning-events.js';
import type { Message } from '../types/index.js';

const EXTRACT_PROMPT = `The operator just corrected the AI agent. Extract their stated preference as a single, direct fact statement.

Format: "Operator prefers X" or "Never do Y when Z" or "Always use A instead of B".

Correction: {correction}

Respond with ONLY the one-line preference statement. If the correction does not contain a clear, extractable preference (e.g. it is just "wrong" or "no"), respond with: none`;

const MIN_PREFERENCE_CONFIDENCE = 0.55;

export function wordOverlap(a: string, b: string): number {
  const stop = new Set(['the', 'and', 'for', 'not', 'you', 'this', 'that', 'with', 'from', 'when', 'over', 'instead']);
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !stop.has(w)));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !stop.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let hit = 0;
  for (const w of wordsA) if (wordsB.has(w)) hit++;
  return hit / new Set([...wordsA, ...wordsB]).size;
}

export function scorePreferenceConfidence(preference: string, correction: string): number {
  const trimmed = preference.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return 0;

  let score = 0.45;
  if (trimmed.length >= 30) score += 0.15;
  if (trimmed.length >= 50) score += 0.1;
  if (/\b(prefer|always|never|instead|use|avoid|must|should|do not|don't)\b/i.test(trimmed)) {
    score += 0.25;
  }
  if (correction.trim().length < 12) score -= 0.25;
  if (trimmed.length > 200) score -= 0.3;
  return Math.max(0, Math.min(1, score));
}

export interface PreferenceLearnResult {
  learned: boolean;
  action?: 'added' | 'replaced' | 'skipped';
  preference?: string;
  confidence?: number;
  skipReason?: string;
}

export async function learnPreferenceFromCorrection(
  userMessage: string,
  context: { tenantId?: string; sessionId?: string } = {},
): Promise<PreferenceLearnResult> {
  try {
    const messages: Message[] = [{
      role: 'user',
      content: EXTRACT_PROMPT.replace('{correction}', userMessage.slice(0, 400)),
      timestamp: new Date(),
    }];
    const response = await llm.chatCheap(messages);
    const preference = response.content.trim();
    if (!preference || preference.toLowerCase() === 'none') {
      await appendLearningEvent({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        eventType: 'preference_skipped',
        inputSummary: { correctionLength: userMessage.length },
        outputSummary: { skipReason: 'no_extractable_preference' },
        internalNotes: { raw: response.content.slice(0, 500) },
      });
      return { learned: false, action: 'skipped', skipReason: 'no_extractable_preference' };
    }
    if (preference.length > 200) {
      return { learned: false, action: 'skipped', skipReason: 'too_long' };
    }

    const confidence = scorePreferenceConfidence(preference, userMessage);
    if (confidence < MIN_PREFERENCE_CONFIDENCE) {
      await appendLearningEvent({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        eventType: 'preference_skipped',
        inputSummary: { correctionLength: userMessage.length },
        outputSummary: { skipReason: 'low_confidence', confidence, preference },
        internalNotes: { raw: response.content.slice(0, 500) },
      });
      return {
        learned: false,
        action: 'skipped',
        preference,
        confidence,
        skipReason: 'low_confidence',
      };
    }

    const existing = await getPersistentFactsText('user');
    if (existing) {
      for (const line of existing.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (wordOverlap(preference, trimmed) >= 0.65) {
          await replacePersistentFact('user', trimmed, preference);
          await appendLearningEvent({
            tenantId: context.tenantId,
            sessionId: context.sessionId,
            eventType: 'preference_replaced',
            outputSummary: { preference, confidence, previous: trimmed },
          });
          return { learned: true, action: 'replaced', preference, confidence };
        }
      }
    }

    await addPersistentFact('user', preference);
    await appendLearningEvent({
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      eventType: 'preference_learned',
      outputSummary: { preference, confidence },
    });
    return { learned: true, action: 'added', preference, confidence };
  } catch {
    return { learned: false, action: 'skipped', skipReason: 'error' };
  }
}
