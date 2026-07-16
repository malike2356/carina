import type { AmbientChannelMessage, ExtractedChannelFact } from './types.js';

export interface SignalScore {
  batchId: string;
  channelId: string;
  score: number;
  triggers: string[];
  messages: AmbientChannelMessage[];
}

const SIGNAL_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /let'?s (do|go with|try|start|build|ship|launch)/i, weight: 20, label: 'decision' },
  { pattern: /(approved|decided|agreed|confirmed|signed off)/i, weight: 15, label: 'decision' },
  { pattern: /we'?re going to|we will|the plan is/i, weight: 10, label: 'decision' },
  { pattern: /(deadline|due|by (monday|tuesday|wednesday|thursday|friday|next week|eow|eom))/i, weight: 25, label: 'deadline' },
  { pattern: /(need|must|have to) (this|it|that) (by|before|this week)/i, weight: 20, label: 'deadline' },
  { pattern: /@\w+ (is|will be|will) (working on|handling|taking|leading|responsible)/i, weight: 15, label: 'assignment' },
  { pattern: /(assign(ed)?|owner|responsible|point person) (is|:) @?\w+/i, weight: 15, label: 'assignment' },
  { pattern: /(shipped|deployed|launched|released|went live|in production)/i, weight: 15, label: 'status' },
  { pattern: /(blocked|stuck|waiting on|dependency|depends on)/i, weight: 20, label: 'blocker' },
  { pattern: /does anyone know|who knows|where (is|are)|what'?s the status/i, weight: 10, label: 'knowledge_gap' },
  { pattern: /\$\d+[km]?|£\d+[km]?|€\d+[km]?|\d+% (increase|decrease|growth|drop)/i, weight: 15, label: 'metric' },
  { pattern: /(revenue|mrr|arr|churn|conversion|traffic|dau|mau) (is|was|at|up|down)/i, weight: 15, label: 'metric' },
  { pattern: /(project|initiative|feature|sprint|release|milestone) \w+/i, weight: 10, label: 'project' },
];

export function scoreChannelBatch(
  channelId: string,
  messages: AmbientChannelMessage[],
): SignalScore {
  let totalScore = 0;
  const triggers: string[] = [];
  const combinedText = messages.map((m) => m.text).join(' ');

  for (const { pattern, weight, label } of SIGNAL_PATTERNS) {
    if (pattern.test(combinedText)) {
      totalScore += weight;
      if (!triggers.includes(label)) triggers.push(label);
    }
  }

  const uniqueUsers = new Set(messages.map((m) => m.userId)).size;
  if (uniqueUsers >= 3) totalScore += 10;

  const threadCount = messages.filter((m) => m.threadTs).length;
  if (threadCount >= 3) totalScore += 10;

  const avgLength = messages.reduce((sum, m) => sum + m.text.length, 0) / Math.max(messages.length, 1);
  if (avgLength < 30) totalScore -= 10;

  if (messages.some((m) => m.isPinned)) totalScore += 25;
  if (messages.some((m) => m.hasFiles)) totalScore += 15;

  return {
    batchId: `batch_${channelId}_${Date.now()}`,
    channelId,
    score: Math.max(0, Math.min(100, totalScore)),
    triggers,
    messages,
  };
}

export function heuristicFactsFromBatch(
  scored: SignalScore,
  channelName: string,
): ExtractedChannelFact[] {
  if (scored.score < 15 || scored.messages.length === 0) return [];

  const combined = scored.messages.map((m) => m.text).join(' ');
  const primaryType = mapTriggerToFactType(scored.triggers[0] ?? 'status');
  const summary = combined.length > 120 ? `${combined.slice(0, 117)}...` : combined;

  return [{
    type: primaryType,
    summary,
    detail: scored.messages
      .slice(0, 5)
      .map((m) => `[${m.userName}] ${m.text}`)
      .join('\n'),
    confidence: Math.min(0.95, scored.score / 100),
    sourceMessages: scored.messages.slice(0, 5).map((m) => m.permalink),
    entities: {},
    staleAfter: staleAfterForType(primaryType),
  }];
}

function mapTriggerToFactType(trigger: string): ExtractedChannelFact['type'] {
  switch (trigger) {
    case 'decision': return 'decision';
    case 'deadline': return 'deadline';
    case 'assignment': return 'person_working_on';
    case 'blocker': return 'blocker';
    case 'knowledge_gap': return 'knowledge_gap';
    case 'metric': return 'metric';
    case 'project': return 'project_reference';
    default: return 'status_update';
  }
}

function staleAfterForType(type: ExtractedChannelFact['type']): ExtractedChannelFact['staleAfter'] {
  if (type === 'deadline') return 'manual';
  if (type === 'metric') return '30d';
  if (type === 'status_update') return '7d';
  return '24h';
}
