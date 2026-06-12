import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  evaluatePolicy,
  evaluateContext,
  evaluateOutputProtection,
  setPolicyGatewayDeps,
} from '../security/policy-gateway.js';
import { logPolicyDecision, isSessionBlocked } from '../lib/policy-audit.js';
import { getRedis } from '../redis.js';
import type {
  PolicyActionType,
  PolicyEvaluateRequest,
  ContextSourceType,
} from '../security/policy-decisions.js';
import { resolveActionTypeFromTool } from '../security/risk-registry.js';

export const policyEvaluateRouter: IRouter = Router();

const VALID_ACTION_TYPES = new Set<PolicyActionType>([
  'shell', 'http', 'file_write', 'email', 'messaging', 'tool_chain', 'credential',
]);

const VALID_CONTEXT_TYPES = new Set<ContextSourceType>([
  'user_prompt', 'tool_output', 'web_fetch', 'email_body',
  'attachment_text', 'rag_chunk', 'imported_doc',
]);

const QUARANTINE_KEY_PREFIX = 'scout:quarantine:';

async function isToolQuarantined(instanceId: string, toolName: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const key = `${QUARANTINE_KEY_PREFIX}${instanceId}:${toolName}`;
    return (await redis.exists(key)) === 1;
  } catch {
    return false;
  }
}

setPolicyGatewayDeps({
  logDecision: logPolicyDecision,
  isSessionBlocked,
  isToolQuarantined,
});

function parseEvaluateBody(body: unknown): PolicyEvaluateRequest | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.session_id !== 'string' || !b.session_id.trim()) {
    return { error: 'session_id is required' };
  }

  const toolName = typeof b.tool_name === 'string' ? b.tool_name : undefined;
  let actionType: PolicyActionType | undefined;

  if (typeof b.action_type === 'string' && VALID_ACTION_TYPES.has(b.action_type as PolicyActionType)) {
    actionType = b.action_type as PolicyActionType;
  } else if (toolName) {
    actionType = resolveActionTypeFromTool(toolName);
  }

  if (!actionType) {
    return { error: 'action_type or tool_name is required' };
  }

  return {
    actionType,
    sessionId: b.session_id.trim(),
    instanceId: typeof b.instance_id === 'string' ? b.instance_id : undefined,
    toolName,
    params: typeof b.params === 'object' && b.params !== null && !Array.isArray(b.params)
      ? b.params as Record<string, unknown>
      : undefined,
    content: typeof b.content === 'string' ? b.content : undefined,
    contextType: typeof b.context_type === 'string' && VALID_CONTEXT_TYPES.has(b.context_type as ContextSourceType)
      ? b.context_type as ContextSourceType
      : undefined,
    confirmed: b.confirmed === true,
  };
}

policyEvaluateRouter.post('/evaluate', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = parseEvaluateBody(req.body);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const decision = await evaluatePolicy(parsed, req);
    res.json(decision);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:policy-evaluate] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

policyEvaluateRouter.post('/context', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.content !== 'string' || typeof body.session_id !== 'string') {
      res.status(400).json({ error: 'content and session_id are required' });
      return;
    }
    const contextType = typeof body.context_type === 'string'
      && VALID_CONTEXT_TYPES.has(body.context_type as ContextSourceType)
      ? body.context_type as ContextSourceType
      : 'user_prompt';
    const toolName = typeof body.tool_name === 'string' ? body.tool_name : undefined;

    const decision = await evaluateContext(
      body.content,
      contextType,
      body.session_id,
      req,
      toolName,
    );
    res.json(decision);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:policy-context] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

policyEvaluateRouter.post('/output', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.content !== 'string' || typeof body.session_id !== 'string') {
      res.status(400).json({ error: 'content and session_id are required' });
      return;
    }
    const toolName = typeof body.tool_name === 'string' ? body.tool_name : undefined;

    const decision = await evaluateOutputProtection(
      body.content,
      body.session_id,
      req,
      toolName,
    );
    res.json(decision);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:policy-output] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
