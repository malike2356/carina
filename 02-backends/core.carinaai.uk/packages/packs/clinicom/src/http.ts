import express, { type Express, type Request, type Response } from 'express';
import {
  dispatchClinicomTool,
  type ClinicomToolRoute,
} from '../tools/handlers.js';

const ROUTE_TO_TOOL: Record<string, ClinicomToolRoute> = {
  transcribe: 'transcribe',
  translate: 'translate',
  simplify: 'simplify',
  speak: 'speak',
  cultural_adapt: 'cultural_adapt',
  teachback_score: 'teachback_score',
  safety_triage_assist: 'safety_triage_assist',
  session_digest: 'session_digest',
  specialty_simplify: 'specialty_simplify',
  confidence_explain: 'confidence_explain',
  product_help: 'product_help',
};

function sharedToken(): string {
  return (process.env.CLINICOM_SHARED_TOKEN ?? process.env.CLINICOM_SIDECAR_TOKEN ?? '').trim();
}

function checkToken(req: Request, res: Response): boolean {
  const token = sharedToken();
  if (!token) return true;
  const header = req.header('authorization') ?? '';
  if (header === `Bearer ${token}`) return true;
  res.status(401).json({ detail: 'Invalid sidecar token' });
  return false;
}

export function mountClinicomSidecarRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      sidecar: 'carina-clinicom',
      pack: 'clinicom',
    });
  });

  app.get('/clinicom/capabilities', (_req, res) => {
    const liveRoutes = new Set(['transcribe', 'translate', 'simplify', 'speak', 'product_help']);
    const tools = Object.keys(ROUTE_TO_TOOL).map((route) => ({
      name: route,
      status: liveRoutes.has(route) ? 'live' : 'stub',
      latency_class: route === 'session_digest' || route === 'confidence_explain' || route === 'product_help' ? 'low' : 'medium',
      requires_auth: false,
      source: liveRoutes.has(route) ? 'carina' : 'carina-clinicom-stub',
    }));
    res.json({
      contract_version: '2.0',
      profile: 'carina',
      tools,
      provider_sources: Object.fromEntries(tools.map((tool) => [tool.name, tool.source])),
      loaded_at: new Date().toISOString(),
    });
  });

  for (const route of Object.keys(ROUTE_TO_TOOL)) {
    app.post(`/clinicom/tools/${route}`, express.json({ limit: '4mb' }), async (req, res) => {
      if (!checkToken(req, res)) return;
      const toolRoute = ROUTE_TO_TOOL[route];
      try {
        const result = await dispatchClinicomTool(toolRoute, req.body ?? {});
        if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
          res.status(400).json(result);
          return;
        }
        res.json(result);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : String(err),
          status: 'error',
        });
      }
    });
  }
}

export function createClinicomSidecarApp(): Express {
  const app = express();
  mountClinicomSidecarRoutes(app);
  return app;
}
