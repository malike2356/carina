import { Router, type Request, type Response } from 'express';
import { embed } from '../../memory/embeddings.js';
import { requireOpenAiAuth } from './auth.js';
import { runChatCompletion, type ChatCompletionRequest } from './chat-completions.js';

export const openAiResponsesRouter = Router();
export const openAiEmbeddingsRouter = Router();

type ResponsesRequest = {
  model: string;
  input: string | Array<{ role: string; content: string }>;
  instructions?: string;
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  carina_session_id?: string;
  carina_thinking_level?: string;
};

function estimateTokens(inputs: string[]): number {
  return inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
}

openAiResponsesRouter.post('/v1/responses', requireOpenAiAuth, async (req: Request, res: Response) => {
  const body = req.body as ResponsesRequest;
  const messages: ChatCompletionRequest['messages'] = [];
  if (body.instructions) {
    messages.push({ role: 'system', content: body.instructions });
  }
  if (typeof body.input === 'string') {
    messages.push({ role: 'user', content: body.input });
  } else if (Array.isArray(body.input)) {
    for (const item of body.input) {
      const role = item.role === 'assistant' || item.role === 'system' ? item.role : 'user';
      messages.push({ role, content: String(item.content ?? '') });
    }
  }

  const chatBody: ChatCompletionRequest = {
    model: body.model,
    messages,
    stream: body.stream,
    temperature: body.temperature,
    max_tokens: body.max_output_tokens,
    carina_session_id: body.carina_session_id,
    carina_thinking_level: body.carina_thinking_level,
  };

  const authUser = String((req as Request & { session?: { userId?: string } }).session?.userId ?? 'api');

  if (body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
      const result = await runChatCompletion(chatBody, authUser);
      const id = `resp_${result.sessionId.slice(0, 8)}`;
      const created = Math.floor(Date.now() / 1000);
      if (result.content) {
        res.write(`data: ${JSON.stringify({
          id,
          object: 'response.chunk',
          created,
          model: body.model,
          output: [{ type: 'message', content: result.content }],
        })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: { message, type: 'server_error' } });
    }
    return;
  }

  try {
    const result = await runChatCompletion(chatBody, authUser);
    res.json({
      id: `resp_${result.sessionId.slice(0, 8)}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      model: body.model,
      output: [{ type: 'message', role: 'assistant', content: result.content }],
      status: 'completed',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message, type: 'server_error' } });
  }
});

openAiEmbeddingsRouter.post('/v1/embeddings', requireOpenAiAuth, async (req: Request, res: Response) => {
  const { model, input } = req.body as { model?: string; input?: string | string[] };
  if (input === undefined || input === null) {
    res.status(400).json({ error: { message: 'input is required', type: 'invalid_request_error' } });
    return;
  }
  const inputs = Array.isArray(input) ? input.map(String) : [String(input)];
  try {
    const embeddings = await Promise.all(inputs.map((text) => embed(text)));
    res.json({
      object: 'list',
      data: embeddings.map((embedding, index) => ({
        object: 'embedding',
        index,
        embedding,
      })),
      model: model ?? 'carina-default',
      usage: {
        prompt_tokens: estimateTokens(inputs),
        total_tokens: estimateTokens(inputs),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message, type: 'server_error' } });
  }
});
