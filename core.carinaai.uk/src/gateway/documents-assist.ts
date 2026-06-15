import { llm } from '../brain/llm.js';
import type { Message } from '../types/index.js';

export interface DocumentAssistInput {
  content: string;
  format: string;
  instruction: string;
  selection?: string;
}

export type AssistChatFn = (
  messages: Message[],
) => Promise<{ content: string }>;

const ASSIST_SYSTEM = [
  'You are a writing assistant embedded in a document editor.',
  'Return only the revised text the user should paste back.',
  'Do not add preamble, labels, markdown fences, or explanations.',
  'Preserve the document format unless the instruction asks to convert format.',
].join(' ');

export async function suggestDocumentEdit(
  input: DocumentAssistInput,
  chatFn: AssistChatFn = (messages) => llm.chat(messages),
): Promise<string> {
  const scope = input.selection?.trim()
    ? `Selected text:\n${input.selection}\n\nFull document:\n${input.content}`
    : `Full document:\n${input.content}`;

  const userPrompt = [
    `Document format: ${input.format}`,
    scope,
    `Instruction: ${input.instruction}`,
    input.selection?.trim()
      ? 'Rewrite only the selected text.'
      : 'Rewrite the full document.',
  ].join('\n\n');

  const messages: Message[] = [
    { role: 'system', content: ASSIST_SYSTEM, timestamp: new Date() },
    { role: 'user', content: userPrompt, timestamp: new Date() },
  ];

  const result = await chatFn(messages);
  return result.content.trim();
}
