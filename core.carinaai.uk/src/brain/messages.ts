import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { Message, Tool } from '../types/index.js';
import { registry } from '../tools/registry.js';

export function anthropicTools(tools?: Tool[]): Anthropic.Messages.Tool[] {
  const list = tools ?? registry.list();
  if (list.length === 0) return [];
  return registry.toProviderFormat('anthropic', list) as Anthropic.Messages.Tool[];
}

export function openaiTools(tools?: Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const list = tools ?? registry.list();
  if (list.length === 0) return [];
  return registry.toProviderFormat('openai', list) as OpenAI.Chat.Completions.ChatCompletionTool[];
}

export function toAnthropicMessages(
  messages: Message[],
): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      out.push({ role: 'user', content: m.content });
      continue;
    }

    if (m.role === 'tool_result') {
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId ?? '',
            content: JSON.stringify(m.result ?? ''),
          },
        ],
      });
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      if (m.content) {
        blocks.push({ type: 'text', text: m.content });
      }
      for (const tc of m.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.toolCallId,
          name: tc.toolName,
          input: tc.params,
        });
      }
      out.push({ role: 'assistant', content: blocks });
      continue;
    }

    if (m.role === 'user' || m.role === 'assistant') {
      out.push({
        role: m.role,
        content: m.content,
      });
    }
  }

  return out;
}

export function toOpenAIMessages(
  messages: Message[],
  systemPrompt: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const m of messages) {
    if (m.role === 'system') {
      out.push({ role: 'user', content: m.content });
      continue;
    }

    if (m.role === 'tool_result') {
      out.push({
        role: 'tool',
        tool_call_id: m.toolCallId ?? '',
        content: JSON.stringify(m.result ?? ''),
      });
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          type: 'function' as const,
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.params),
          },
        })),
      });
      continue;
    }

    if (m.role === 'user' || m.role === 'assistant') {
      out.push({
        role: m.role,
        content: m.content,
      });
    }
  }

  return out;
}
