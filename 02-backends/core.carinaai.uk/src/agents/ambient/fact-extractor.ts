import { config } from '../../config/index.js';
import type { AmbientChannelMessage, ExtractedChannelFact } from './types.js';
import { heuristicFactsFromBatch, scoreChannelBatch } from './signal-detector.js';
import { isDuplicateFact, queryChannelFacts } from './channel-memory-store.js';

export async function extractChannelFacts(
  channelId: string,
  channelName: string,
  messages: AmbientChannelMessage[],
): Promise<ExtractedChannelFact[]> {
  if (messages.length === 0) return [];

  const scored = scoreChannelBatch(channelId, messages);
  if (scored.score < config.ambient.signalThreshold) return [];

  let facts: ExtractedChannelFact[] = [];
  if (config.ambient.llmExtraction) {
    try {
      facts = await extractFactsWithLlm(channelName, messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[carina:ambient] LLM extraction failed for ${channelId}: ${msg}`);
    }
  }
  if (facts.length === 0) {
    facts = heuristicFactsFromBatch(scored, channelName);
  }

  const existing = await queryChannelFacts({ scope: `channel:${channelId}`, limit: 200 });
  return facts.filter((fact) => !isDuplicateFact(fact, existing));
}

async function extractFactsWithLlm(
  channelName: string,
  messages: AmbientChannelMessage[],
): Promise<ExtractedChannelFact[]> {
  const { llm } = await import('../../brain/llm.js');
  const formatted = messages
    .map((m) => `[${m.userName}] ${m.text}${m.isPinned ? ' [PINNED]' : ''}`)
    .join('\n');

  const prompt = [
    `Extract durable facts from Slack channel ${channelName} as JSON array.`,
    'Each item: type, summary, detail, confidence (0-1), entities (people, projects, dates).',
    'Skip small talk. Return [] if nothing durable.',
    '',
    formatted,
  ].join('\n');

  const response = await llm.chat([{ role: 'user', content: prompt, timestamp: new Date() }]);
  const text = response.content.trim();
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart < 0 || jsonEnd <= jsonStart) return [];

  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as ExtractedChannelFact[];
  return parsed.map((fact) => ({
    ...fact,
    sourceMessages: messages.slice(0, 5).map((m) => m.permalink),
    staleAfter: fact.staleAfter ?? staleAfterForType(fact.type),
  }));
}

function staleAfterForType(type: ExtractedChannelFact['type']): ExtractedChannelFact['staleAfter'] {
  if (type === 'deadline') return 'manual';
  if (type === 'metric') return '30d';
  if (type === 'status_update') return '7d';
  return '24h';
}
