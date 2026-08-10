/** Chat/agent-turn routing to Keprix product sidecar (CAS-06 primary path). */

import { randomUUID } from 'node:crypto';
import { appendAgentEngineLog, readAgentEngineState, resolveEngineForWorkspace } from './store.js';
import type { AgentEngineName } from './types.js';

export type KeprixProductKey = 'carina' | 'aiva';

export type KeprixAgentRunInput = {
  workspaceId: string;
  sessionId: string;
  message: string;
  systemPrompt?: string;
  model?: string;
  product?: KeprixProductKey;
  workerId?: string | null;
  shadow?: boolean;
  idempotencyKey?: string;
  tools?: KeprixSessionTool[];
};

export type KeprixSessionTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  http_endpoint: string;
  auth_header: string;
  workspace_id: string;
  worker_id: string;
  conversation_id: string;
  product: KeprixProductKey;
};

export type KeprixAgentRunResult = {
  ok: true;
  text: string;
  product: KeprixProductKey;
  finishReason: string | null;
  degraded?: false;
} | {
  ok: false;
  error: string;
  status?: number;
};

function keprixUrl(): string {
  const fromState = readAgentEngineState().config.keprix_url;
  return (fromState || process.env.CARINA_KEPRIX_URL || process.env.KEPRIX_URL || 'http://127.0.0.1:3333').replace(/\/$/, '');
}

function sharedToken(): string {
  return (
    process.env.CARINA_KEPRIX_SHARED_TOKEN
    ?? process.env.KEPRIX_CARINA_SHARED_TOKEN
    ?? process.env.KEPRIX_SERVICE_TOKEN
    ?? ''
  ).trim();
}

function callbackBaseUrl(): string {
  return (
    process.env.CARINA_KEPRIX_CALLBACK_BASE_URL
    ?? process.env.CARINA_CORE_URL
    ?? process.env.CORE_URL
    ?? 'https://core.carinaai.uk'
  ).replace(/\/$/, '');
}

export async function buildKeprixSessionTools(input: {
  workspaceId: string;
  sessionId: string;
  workerId: string;
  product: KeprixProductKey;
}): Promise<KeprixSessionTool[]> {
  const token = sharedToken();
  if (!token) return [];
  const { listSessionTools } = await import('../../tools/session-tool-store.js');
  const endpointBase = callbackBaseUrl();
  return listSessionTools(input.sessionId)
    .filter((tool) => !tool.dangerous && !tool.requiresConfirmation)
    .map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
    http_endpoint: `${endpointBase}/api/keprix/v1/tools/${encodeURIComponent(input.sessionId)}/${encodeURIComponent(tool.name)}`,
    auth_header: `Bearer ${token}`,
    workspace_id: input.workspaceId,
    worker_id: input.workerId,
    conversation_id: input.sessionId,
    product: input.product,
    }));
}

/** Prefer tenant/workspace id; else parse cloud:{workspace}:{clientSession}. */
export function resolveWorkspaceIdForChat(opts: {
  tenantId?: string | null;
  sessionId?: string | null;
  clientSessionId?: string | null;
}): string {
  const tenant = String(opts.tenantId ?? '').trim();
  if (tenant) return tenant;
  for (const raw of [opts.clientSessionId, opts.sessionId]) {
    const value = String(raw ?? '').trim();
    const cloud = /^cloud:([^:]+):/i.exec(value);
    if (cloud?.[1]) return cloud[1];
    const hosted = /^hosted:([^:]+):/i.exec(value);
    if (hosted?.[1]) return hosted[1];
  }
  return String(opts.sessionId ?? 'default').trim() || 'default';
}

export function resolveKeprixProductForChat(opts: {
  workerPresent?: boolean;
  sessionId?: string | null;
  clientSessionId?: string | null;
  productHint?: string | null;
}): KeprixProductKey {
  const hint = String(opts.productHint ?? process.env.CARINA_KEPRIX_PRODUCT ?? '').trim().toLowerCase();
  if (hint === 'aiva' || hint === 'carina') return hint;
  if (opts.workerPresent) return 'aiva';
  const blob = `${opts.clientSessionId ?? ''} ${opts.sessionId ?? ''}`.toLowerCase();
  if (blob.includes('aiva') || blob.includes('hireaiva') || blob.startsWith('cloud:')) {
    return 'aiva';
  }
  return 'carina';
}

export function shouldRouteChatThroughKeprix(workspaceId?: string | null): boolean {
  if (String(process.env.CARINA_KEPRIX_CHAT_PRIMARY ?? 'true').trim().toLowerCase() === 'false') {
    return false;
  }
  return resolveEngineForWorkspace(workspaceId) === 'keprix';
}

/**
 * Gmail and other connected-account work stays on the canonical Carina product-tool
 * path. This is the path that resolves the workspace grant and OAuth account shown
 * in Aiva Tools. The standalone Keprix Google Workspace connector is not an Aiva
 * fallback, because it has a separate credential and grant model.
 */
export function messageNeedsCarinaNativeTools(message: string): boolean {
  const text = String(message ?? '');
  if (!text.trim()) return false;
  return /\b(leads?|prospects?|crm|outreach|companies[-\s]?house|company number|ingest|lead list|follow[- ]?up|find|look up|search|contacts?|person|people|email|emails|mail|inbox|gmail|find (me )?(?:\d+\s+)?(?:businesses|companies|customers|prospects)|generate .{0,40}leads?|web search|tavily|google (?:drive|calendar|contacts)|calendar sync|soft wall|approvals?)\b/i
    .test(text);
}

export function resolveEngineName(workspaceId?: string | null): AgentEngineName {
  return resolveEngineForWorkspace(workspaceId);
}

function extractAssistantText(body: Record<string, unknown>): string {
  const result = (body.result && typeof body.result === 'object')
    ? body.result as Record<string, unknown>
    : body;
  const message = result.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string') return content;
  }
  if (typeof result.content === 'string') return result.content;
  if (typeof result.reply === 'string') return result.reply;
  if (typeof result.text === 'string') return result.text;
  return '';
}

/** Invoke Keprix product sidecar agent.run (non-streaming; caller yields text). */
export async function invokeKeprixAgentRun(input: KeprixAgentRunInput): Promise<KeprixAgentRunResult> {
  const token = sharedToken();
  if (!token) {
    return { ok: false, error: 'CARINA_KEPRIX_SHARED_TOKEN not set' };
  }

  const config = readAgentEngineState().config;
  const product = input.product ?? 'carina';
  const timeoutMs = Math.max(15_000, (Number(config.timeout_seconds) || 30) * 1000);
  const correlationId = `chat-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const model = (input.model || config.default_model || 'deepseek-v4-pro').trim();
  const tools = input.tools ?? [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${keprixUrl()}/v1/products/${product}/invoke`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({
        node: 'agent.run',
        workspace_id: input.workspaceId,
        shadow: Boolean(input.shadow),
        idempotency_key: input.idempotencyKey ?? correlationId,
        input: {
          session_id: input.sessionId,
          model,
          temperature: 0.7,
          system_prompt: input.systemPrompt ?? '',
          messages: [{ role: 'user', content: input.message }],
          tools: tools.map(({ name, description, parameters }) => ({ name, description, parameters })),
          carina_tools: tools,
          worker_id: input.workerId ?? null,
          inject_worker_kb: true,
          escalation_enabled: true,
        },
      }),
      signal: controller.signal,
    });

    const rawText = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
    } catch {
      body = { raw: rawText };
    }

    if (!res.ok) {
      const detail = typeof body.detail === 'object' && body.detail
        ? JSON.stringify(body.detail)
        : (typeof body.error === 'string' ? body.error : rawText.slice(0, 240));
      return { ok: false, error: `Keprix invoke HTTP ${res.status}: ${detail}`, status: res.status };
    }

    const text = extractAssistantText(body).trim();
    if (!text) {
      return { ok: false, error: 'Keprix agent.run returned empty assistant text', status: res.status };
    }

    const result = (body.result && typeof body.result === 'object')
      ? body.result as Record<string, unknown>
      : body;
    return {
      ok: true,
      text,
      product,
      finishReason: typeof result.finish_reason === 'string' ? result.finish_reason : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Yield assistant text as one or more chunks (SSE-friendly). */
export async function* streamKeprixAgentRun(
  input: KeprixAgentRunInput,
): AsyncGenerator<string, KeprixAgentRunResult> {
  const result = await invokeKeprixAgentRun(input);
  if (!result.ok) {
    appendAgentEngineLog({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: `Keprix chat primary failed; falling back to Carina: ${result.error}`,
      source: 'chat-engine',
      workspace_id: input.workspaceId,
    });
    return result;
  }
  appendAgentEngineLog({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `Keprix chat primary ok product=${result.product} chars=${result.text.length}`,
    source: 'chat-engine',
    workspace_id: input.workspaceId,
  });
  // Chunk so SSE clients see progressive tokens without true token streaming yet.
  const chunkSize = 48;
  for (let i = 0; i < result.text.length; i += chunkSize) {
    yield result.text.slice(i, i + chunkSize);
  }
  return result;
}
