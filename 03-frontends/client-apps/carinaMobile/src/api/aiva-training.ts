import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';
import { planGateFromError, type PlanGateInfo } from '@/api/aiva-automations';

export interface AivaKnowledgeEntry {
  id: string;
  type: 'document' | 'faq' | string;
  title: string;
  charCount: number;
  enabled: boolean;
  preview: string | null;
}

export interface AivaKnowledgeList {
  entries: AivaKnowledgeEntry[];
  usedChars: number;
  maxChars: number;
  planTier: string | null;
  planGate: PlanGateInfo;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseKnowledgeEntry(raw: unknown): AivaKnowledgeEntry | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    type: asString(row.type, 'faq'),
    title: asString(row.title, 'Untitled'),
    charCount: Number(row.charCount ?? 0),
    enabled: Boolean(row.enabled ?? true),
    preview: asString(row.preview) || null,
  };
}

export function parseKnowledgeList(payload: unknown): AivaKnowledgeList {
  const root = asRecord(payload) ?? {};
  const list = Array.isArray(root.entries) ? root.entries : [];
  return {
    entries: list
      .map((item) => parseKnowledgeEntry(item))
      .filter((item): item is AivaKnowledgeEntry => item !== null),
    usedChars: Number(root.usedChars ?? 0),
    maxChars: Number(root.maxChars ?? 50_000),
    planTier: typeof root.planTier === 'string' ? root.planTier : null,
    planGate: { required: false, planTier: null, planRequired: null, message: null },
  };
}

export function validateFaqInput(question: string, answer: string): string | null {
  if (!question.trim() || !answer.trim()) {
    return 'Question and answer are required.';
  }
  return null;
}

async function trainingRequest<T>(
  baseUrl: string,
  path: string,
  auth: GatewayAuthOptions | undefined,
  init: RequestInit | undefined,
  label: string,
  parse: (payload: unknown) => T,
): Promise<T> {
  const response = await fetch(
    buildAivaUrl(baseUrl, path),
    mergeGatewayInit(auth, {
      method: 'GET',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    }),
  );
  const text = await response.text();
  if (!response.ok) {
    throw formatAivaApiError(label, response.status, text, response.statusText);
  }
  if (!text.trim()) {
    return parse({});
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new AivaApiError(response.status, `${label}: server returned non-JSON body`, {
      body: text,
    });
  }
  return parse(payload);
}

export async function listWorkerKnowledge(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaKnowledgeList> {
  try {
    return await trainingRequest(
      baseUrl,
      `/api/aiva/workers/${encodeURIComponent(workerId)}/knowledge`,
      auth,
      undefined,
      'Aiva training',
      parseKnowledgeList,
    );
  } catch (err) {
    const gate = planGateFromError(err);
    if (gate.required) {
      return {
        entries: [],
        usedChars: 0,
        maxChars: 50_000,
        planTier: gate.planTier,
        planGate: gate,
      };
    }
    throw err;
  }
}

export function createWorkerFaq(
  baseUrl: string,
  workerId: string,
  question: string,
  answer: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  const validation = validateFaqInput(question, answer);
  if (validation) throw new AivaApiError(400, validation);
  return trainingRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/knowledge/faq`,
    auth,
    {
      method: 'POST',
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
    },
    'Aiva FAQ create',
    () => ({ ok: true }),
  );
}

export function deleteWorkerKnowledge(
  baseUrl: string,
  workerId: string,
  entryId: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return trainingRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/knowledge/${encodeURIComponent(entryId)}`,
    auth,
    { method: 'DELETE' },
    'Aiva knowledge delete',
    () => ({ ok: true }),
  );
}
