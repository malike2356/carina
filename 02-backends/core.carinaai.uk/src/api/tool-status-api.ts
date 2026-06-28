import { Router, type Router as ExpressRouter } from 'express';
import { TOOL_CAPABILITIES } from '../credentials/tool-capabilities.js';
import { getCredentialStatus } from '../credentials/resolver.js';

export const toolStatusRouter: ExpressRouter = Router();

toolStatusRouter.get('/status', async (_req, res) => {
  try {
    const results = await Promise.all(
      TOOL_CAPABILITIES.map(async (entry) => {
        const statuses = await Promise.all(
          entry.required_credentials.map(getCredentialStatus),
        );
        const allConfigured = statuses.every((s) => s.configured);
        return {
          tool: entry.tool_name,
          category: entry.category,
          description: entry.description,
          status: allConfigured ? 'ready' : entry.required_credentials.length === 0 ? 'ready' : 'unconfigured',
          credentials: statuses,
        };
      }),
    );

    res.json({
      tools: results,
      ready: results.filter((r) => r.status === 'ready').length,
      total: results.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
