import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { buildCapabilityManifest } from '../capabilities/manifest-builder.js';
import {
  buildCapabilityMissing,
  buildCapabilityPromptBlock,
  buildCapabilitySummary,
} from '../capabilities/prompt-injection.js';

type CapabilityRequest = Request & {
  workspaceId?: string;
  query: Request['query'] & {
    sessionId?: string;
    platform?: string;
  };
};

async function resolveManifest(req: CapabilityRequest) {
  const sessionId = typeof req.query.sessionId === 'string' && req.query.sessionId.trim()
    ? req.query.sessionId.trim()
    : `workspace:${req.workspaceId ?? 'operator'}`;
  const platform = typeof req.query.platform === 'string' ? req.query.platform : 'web';

  return buildCapabilityManifest({
    sessionId,
    workspaceId: req.workspaceId ?? null,
    platform,
  });
}

export const capabilityRouter: ExpressRouter = Router();

capabilityRouter.get('/capabilities', async (req: CapabilityRequest, res: Response) => {
  try {
    const manifest = await resolveManifest(req);
    res.json({
      manifest,
      promptBlock: buildCapabilityPromptBlock(manifest),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

capabilityRouter.get('/capabilities/summary', async (req: CapabilityRequest, res: Response) => {
  try {
    const manifest = await resolveManifest(req);
    res.json({ summary: buildCapabilitySummary(manifest) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

capabilityRouter.get('/capabilities/missing', async (req: CapabilityRequest, res: Response) => {
  try {
    const manifest = await resolveManifest(req);
    res.json(buildCapabilityMissing(manifest));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
