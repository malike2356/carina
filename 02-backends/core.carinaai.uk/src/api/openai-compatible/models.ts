import { Router, type IRouter, type Request, type Response } from 'express';
import { buildCatalogRows } from '../../brain/provider-catalog.js';
import { detectReasoningEffort } from '../../brain/provider-capability-detection.js';
import { llm } from '../../brain/llm.js';
import { requireOpenAiAuth } from './auth.js';

export const openAiModelsRouter: IRouter = Router();

type OpenAIModel = {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  carina_capabilities?: {
    thinking: boolean;
    vision: boolean;
    tools: boolean;
    streaming: boolean;
  };
};

function modelRow(providerId: string, modelId: string): OpenAIModel {
  const reasoning = detectReasoningEffort(providerId, modelId);
  return {
    id: `${providerId}/${modelId}`,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: providerId,
    carina_capabilities: {
      thinking: reasoning.supported,
      vision: false,
      tools: true,
      streaming: true,
    },
  };
}

openAiModelsRouter.get('/v1/models', requireOpenAiAuth, (_req: Request, res: Response) => {
  const rows = buildCatalogRows({ runtimeConfigured: new Set(llm.list()) });
  const models: OpenAIModel[] = rows
    .filter((row) => row.configured && row.routable && row.model)
    .map((row) => modelRow(row.id, row.model!));
  res.json({ object: 'list', data: models });
});

openAiModelsRouter.get('/v1/models/:providerId/:modelId', requireOpenAiAuth, (req: Request, res: Response) => {
  const providerId = String(req.params.providerId ?? '');
  const modelId = String(req.params.modelId ?? '');
  const modelParam = `${providerId}/${modelId}`;
  const rows = buildCatalogRows({ runtimeConfigured: new Set(llm.list()) });
  const row = rows.find((entry) => entry.id === providerId && entry.model === modelId);
  if (!row) {
    res.status(404).json({ error: { message: `Model ${modelParam} not found`, type: 'not_found' } });
    return;
  }
  res.json(modelRow(providerId, modelId));
});
