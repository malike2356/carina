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
      'Ask the user a question during a workflow. Provide question and optional choices (max 4). Returns awaiting_clarification status; user answers in next message.',
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
      const question = String(params.question ?? '').trim();
      if (!question) return { error: 'Question is required.' };

      const rawChoices = (params.choices ?? []) as string[];
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
    },
  };
}
