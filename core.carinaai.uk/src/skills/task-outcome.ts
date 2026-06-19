import { saveMemory } from '../memory/store.js';
import {
  appendLearningEvent,
  buildLearningIdempotencyKey,
  hasLearningEvent,
} from './learning-events.js';

export interface TaskOutcomeInput {
  sessionId?: string;
  tenantId?: string;
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
  succeeded?: boolean;
}

export interface TaskOutcomeResult {
  saved: boolean;
  topic?: string;
  reason?: string;
}

const OUTCOME_PREFIX = '[task-outcome]';

export function taskOutcomesEnabled(): boolean {
  return process.env.CARINA_TASK_OUTCOMES !== 'false';
}

export function distillTaskOutcome(input: {
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
}): { topic: string; body: string } | null {
  if (input.toolsUsed.length < 3) return null;

  const cleaned = input.assistantText
    .replace(/\([^)]*saved approach[^)]*\)/gi, '')
    .replace(/\([^)]*refined skill[^)]*\)/gi, '')
    .replace(/\([^)]*learned your preference[^)]*\)/gi, '')
    .trim();
  if (cleaned.length < 40) return null;

  const paragraph = cleaned.split(/\n\n+/).find((p) => p.trim().length >= 20)?.trim()
    ?? cleaned.slice(0, 400);
  const result = paragraph.replace(/\s+/g, ' ').slice(0, 400);
  const topic = input.userMessage.replace(/\s+/g, ' ').trim().slice(0, 120);
  const tools = [...new Set(input.toolsUsed)].slice(0, 8).join(', ');

  const body = [
    OUTCOME_PREFIX,
    `Topic: ${topic}`,
    `Tools: ${tools}`,
    `Result: ${result}`,
    'Recall: session-search or `carina memory sessions search`',
  ].join('\n');

  return { topic, body };
}

export async function persistTaskOutcome(input: TaskOutcomeInput): Promise<TaskOutcomeResult> {
  if (!taskOutcomesEnabled()) {
    return { saved: false, reason: 'disabled' };
  }
  if (!input.sessionId?.trim()) {
    return { saved: false, reason: 'no_session' };
  }

  const distilled = distillTaskOutcome(input);
  if (!distilled) {
    return { saved: false, reason: 'not_enough_signal' };
  }

  const tenantId = input.tenantId ?? '__operator__';
  const idempotencyKey = `outcome:${buildLearningIdempotencyKey({
    tenantId,
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    toolsUsed: input.toolsUsed,
    succeeded: input.succeeded ?? true,
    isCorrection: false,
  })}`;

  if (await hasLearningEvent(idempotencyKey)) {
    return { saved: false, reason: 'deduped', topic: distilled.topic };
  }

  try {
    await saveMemory(input.sessionId, 'system', distilled.body);
    await appendLearningEvent({
      tenantId,
      sessionId: input.sessionId,
      eventType: 'task_outcome_saved',
      idempotencyKey,
      inputSummary: {
        topic: distilled.topic,
        toolsUsed: input.toolsUsed.length,
      },
      outputSummary: {
        preview: distilled.body.slice(0, 240),
      },
    });
    return { saved: true, topic: distilled.topic };
  } catch {
    return { saved: false, reason: 'save_failed', topic: distilled.topic };
  }
}
