import { llm } from '../brain/llm.js';
import type { ExtractedCommitment, TurnExchange } from './types.js';

const EXPLICIT_REMINDER = /\b(remind me|set (a )?reminder|schedule (a )?reminder|wake me up|alarm at|add (it )?to (my )?calendar|cron job)\b/i;

const HEURISTIC_RULES: Array<{
  kind: ExtractedCommitment['kind'];
  pattern: RegExp;
  confidence: number;
  dueInHours: number;
  dueInHoursLatest: number;
  checkInText: string;
  sourceSummary: string;
}> = [
  {
    kind: 'check_in',
    pattern: /\b(job )?interview\b/i,
    confidence: 0.86,
    dueInHours: 20,
    dueInHoursLatest: 72,
    checkInText: 'Checking in after your interview. How did it go?',
    sourceSummary: 'User mentioned an interview',
  },
  {
    kind: 'check_in',
    pattern: /\b(exam|test|assessment)\b.*\b(tomorrow|today|this week|monday|tuesday|wednesday|thursday|friday)\b/i,
    confidence: 0.82,
    dueInHours: 24,
    dueInHoursLatest: 48,
    checkInText: 'Hope the exam went well. Want to talk through how it felt?',
    sourceSummary: 'User mentioned an upcoming exam or test',
  },
  {
    kind: 'care',
    pattern: /\b(exhausted|burnt out|burned out|overwhelmed|stressed|anxious|nervous|rough day|hard day)\b/i,
    confidence: 0.8,
    dueInHours: 12,
    dueInHoursLatest: 36,
    checkInText: 'Wanted to check in and see how you are doing today.',
    sourceSummary: 'User shared stress or exhaustion',
  },
  {
    kind: 'follow_up',
    pattern: /\bwaiting (to|for) hear\b|\bhear back\b|\bwaiting on (a )?response\b|\bresults (should|will) come\b/i,
    confidence: 0.78,
    dueInHours: 48,
    dueInHoursLatest: 120,
    checkInText: 'Any news yet on what you were waiting to hear back about?',
    sourceSummary: 'User is waiting on news or a response',
  },
  {
    kind: 'deadline_adjacent',
    pattern: /\b(presentation|pitch|demo|hearing|procedure|surgery|appointment)\b.*\b(tomorrow|today|this week)\b/i,
    confidence: 0.77,
    dueInHours: 20,
    dueInHoursLatest: 60,
    checkInText: 'How did the event you had coming up go?',
    sourceSummary: 'User mentioned a near-term event',
  },
];

export function isExplicitReminderRequest(text: string): boolean {
  return EXPLICIT_REMINDER.test(text);
}

export function extractCommitmentsHeuristic(exchange: TurnExchange): ExtractedCommitment[] {
  if (isExplicitReminderRequest(exchange.userMessage)) return [];
  const haystack = `${exchange.userMessage}\n${exchange.assistantText}`;
  if (haystack.trim().length < 24) return [];

  const matches: ExtractedCommitment[] = [];
  for (const rule of HEURISTIC_RULES) {
    if (!rule.pattern.test(haystack)) continue;
    matches.push({
      kind: rule.kind,
      confidence: rule.confidence,
      dueInHours: rule.dueInHours,
      dueInHoursLatest: rule.dueInHoursLatest,
      checkInText: rule.checkInText,
      sourceSummary: rule.sourceSummary,
    });
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  const top = matches[0];
  if (!top || top.confidence < minConfidence()) return [];
  return [top];
}

export async function extractCommitmentsWithLlm(exchange: TurnExchange): Promise<ExtractedCommitment[]> {
  const response = await llm.chatCheap([
    {
      role: 'system',
      content: `You extract inferred follow-up commitments from agent conversations.
Return JSON only with shape {"commitments":[]}.
Each commitment object may include:
- kind: check_in | follow_up | care | deadline_adjacent
- confidence: 0.0 to 1.0
- dueInHours: number
- dueInHoursLatest: number
- checkInText: short warm follow-up message
- sourceSummary: one line reason

Rules:
- Skip if the user explicitly asked for a reminder, alarm, or scheduled task.
- Only include natural follow-ups the user did not request.
- Max one commitment.
- confidence must be at least ${minConfidence()} to include.
- If nothing qualifies, return {"commitments":[]}.`,
      timestamp: new Date(),
    },
    {
      role: 'user',
      content: `User:\n${exchange.userMessage}\n\nAssistant:\n${exchange.assistantText}`,
      timestamp: new Date(),
    },
  ]);

  const parsed = parseLlmJson(response.content);
  if (!parsed?.commitments?.length) return [];
  return parsed.commitments
    .filter((c) => c.confidence >= minConfidence())
    .slice(0, 1);
}

export async function extractCommitments(exchange: TurnExchange): Promise<ExtractedCommitment[]> {
  if (isExplicitReminderRequest(exchange.userMessage)) return [];

  const heuristic = extractCommitmentsHeuristic(exchange);
  if (process.env.CARINA_COMMITMENTS_LLM !== 'true') {
    return heuristic;
  }

  try {
    const fromLlm = await extractCommitmentsWithLlm(exchange);
    if (fromLlm.length > 0) return fromLlm;
  } catch {
    // fall back to heuristics
  }
  return heuristic;
}

function minConfidence(): number {
  return Number(process.env.CARINA_COMMITMENTS_MIN_CONFIDENCE ?? '0.75');
}

function parseLlmJson(content: string): { commitments: ExtractedCommitment[] } | null {
  const trimmed = content.trim();
  const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonBlock) return null;
  try {
    const parsed = JSON.parse(jsonBlock[0]) as { commitments?: ExtractedCommitment[] };
    if (!Array.isArray(parsed.commitments)) return { commitments: [] };
    return { commitments: parsed.commitments };
  } catch {
    return null;
  }
}
