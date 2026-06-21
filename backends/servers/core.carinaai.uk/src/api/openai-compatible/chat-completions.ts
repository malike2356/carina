import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getRouter } from '../../gateway/router.js';
import type { CarinaMessage } from '../../types/index.js';
import { parseThinkingLevel, setSessionThinkingLevel } from '../../agents/thinking-levels.js';
import { setSessionConfig } from '../../config/session-config.js';
import { requireOpenAiAuth } from './auth.js';

export const openAiChatRouter = Router();

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  user?: string;
  carina_session_id?: string;
  carina_thinking_level?: string;
};

function lastUserMessage(messages: OpenAIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === 'user' && msg.content) return String(msg.content);
  }
  return '';
}

function applyProviderOverride(sessionId: string, modelParam: string): void {
  const slash = modelParam.indexOf('/');
  if (slash <= 0) return;
  const provider = modelParam.slice(0, slash);
  const model = modelParam.slice(slash + 1);
  setSessionConfig(sessionId, { provider, model });
  getRouter().applySessionProviderOverride(sessionId, { name: provider, model });
}

export async function runChatCompletion(
  body: ChatCompletionRequest,
  authUser?: string,
): Promise<{ sessionId: string; content: string; model: string }> {
  const message = lastUserMessage(body.messages);
  if (!message.trim()) {
    throw new Error('messages must include at least one user message');
  }

  const sessionId = body.carina_session_id ?? `openai:${authUser ?? 'api'}:${randomUUID()}`;
  applyProviderOverride(sessionId, body.model);
  if (body.carina_thinking_level) {
    const level = parseThinkingLevel(body.carina_thinking_level);
    if (level) setSessionThinkingLevel(sessionId, level);
  }

  const router = getRouter();
  const carinaMessage: CarinaMessage = {
    id: randomUUID(),
    sessionId,
    content: message,
    source: 'api',
    timestamp: new Date(),
  };

  const chunks: string[] = [];
  for await (const chunk of router.handle(carinaMessage)) {
    chunks.push(chunk);
  }
  return {
    sessionId,
    content: chunks.join(''),
    model: body.model,
  };
}

openAiChatRouter.post('/v1/chat/completions', requireOpenAiAuth, async (req: Request, res: Response) => {
  const body = req.body as ChatCompletionRequest;
  if (!body?.model || !Array.isArray(body.messages)) {
    res.status(400).json({
      error: { message: 'model and messages are required', type: 'invalid_request_error' },
    });
    return;
  }

  const authUser = String((req as Request & { session?: { userId?: string } }).session?.userId ?? body.user ?? 'api');

  if (body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
      const result = await runChatCompletion(body, authUser);
      const id = `chatcmpl-${result.sessionId.slice(0, 8)}`;
      const created = Math.floor(Date.now() / 1000);
      if (result.content) {
        res.write(`data: ${JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: body.model,
          choices: [{ index: 0, delta: { content: result.content }, finish_reason: null }],
        })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model: body.model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: { message, type: 'server_error' } })}\n\n`);
      res.end();
    }
    return;
  }

  try {
    const result = await runChatCompletion(body, authUser);
    res.json({
      id: `chatcmpl-${result.sessionId.slice(0, 8)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.content },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message, type: 'server_error' } });
  }
});
