import type { Tool } from '../types/index.js';

export interface ClarifyRequest {
  question: string;
  choices?: string[];
  sessionId: string;
  askedAt: Date;
}

const pendingClarifications = new Map<string, ClarifyRequest>();

export function getPendingClarification(sessionId: string): ClarifyRequest | undefined {
  return pendingClarifications.get(sessionId);
}

export function clearPendingClarification(sessionId: string): void {
  pendingClarifications.delete(sessionId);
}

export function createClarifyTool(sessionId: string): Tool {
  return {
    name: 'clarify',
    description:
      'Use this tool when you cannot complete the task without more information from the user: missing parameters, ambiguous intent, or a genuine choice between approaches. Call it with a clear question and up to 4 choices. The user will answer in their next message; you will then resume the original task. Do not use it for rhetorical questions or when you can make a reasonable assumption yourself.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Question to ask the user' },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Up to 4 multiple-choice options',
        },
      },
      required: ['question'],
    },
    execute: async (params) => {
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          return { error: 'sessionId is required.' };
        }

        const question = String(params.question ?? '').trim();
        if (!question) return { error: 'Question is required.' };

        const rawChoices = Array.isArray(params.choices) ? (params.choices as unknown[]) : [];
        const choices = rawChoices.slice(0, 4).map(String);

        const request: ClarifyRequest = {
          question,
          choices: choices.length > 0 ? choices : undefined,
          sessionId,
          askedAt: new Date(),
        };
        pendingClarifications.set(sessionId, request);

        return {
          status: 'awaiting_clarification',
          question,
          choices: request.choices,
          message: choices.length > 0
            ? `Please choose: ${choices.map((c, i) => `${i + 1}. ${c}`).join(' | ')}`
            : 'Please provide your answer in your next message.',
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
