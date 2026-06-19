import type { Request, Response } from 'express';
import { defaultLspSessionKey, executeLspRequest } from '../lsp/client.js';

type LspRequestBody = {
  sessionKey?: string;
  method?: string;
  params?: unknown;
  language?: string;
  rootPath?: string;
};

export async function handleLspRequest(req: Request, res: Response): Promise<void> {
  const body = req.body as LspRequestBody;
  const method = String(body.method ?? '').trim();
  if (!method) {
    res.status(400).json({ error: 'method is required' });
    return;
  }

  const sessionKey = String(body.sessionKey ?? defaultLspSessionKey('desktop'));
  try {
    const result = await executeLspRequest(sessionKey, method, body.params ?? {}, {
      language: body.language,
      rootPath: body.rootPath,
    });
    res.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}
