import type { Express } from 'express';
import { openAiApiEnabled } from './auth.js';
import { openAiChatRouter } from './chat-completions.js';
import { openAiModelsRouter } from './models.js';
import {
  openAiEmbeddingsRouter,
  openAiResponsesRouter,
} from './responses-embeddings.js';

export function mountOpenAiCompatibleRoutes(app: Express): void {
  if (!openAiApiEnabled()) return;
  app.use(openAiModelsRouter);
  app.use(openAiChatRouter);
  app.use(openAiResponsesRouter);
  app.use(openAiEmbeddingsRouter);
}

export { openAiApiEnabled } from './auth.js';
