import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';
import {
  isPlanUpgradeError,
  planGateFromError,
  type PlanGateInfo,
} from '@/api/aiva-automations';

export interface AivaEscalation {
  id: string;
  workerId: string;
  workerName: string;
  channel: string;
  status: string;
  originalInput: string;
  holdingMessage: string;
  createdAt: string;
}

export interface AivaEscalationsList {
  escalations: AivaEscalation[];
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

export function parseEscalation(raw: unknown): AivaEscalation | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    workerId: asString(row.workerId),
    workerName: asString(row.workerName, 'Employee'),
    channel: asString(row.channel, 'unknown'),
    status: asString(row.status, 'open'),
    originalInput: asString(row.originalInput),
    holdingMessage: asString(row.holdingMessage),
    createdAt: asString(row.createdAt),
  };
}

export function parseEscalationsList(payload: unknown): AivaEscalation[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.escalations) ? root.escalations : [];
  return list
    .map((item) => parseEscalation(item))
    .filter((item): item is AivaEscalation => item !== null);
}

export function buildResolveEscalationPayload(resolutionNote: string): {
  resolutionNote: string;
} | null {
  const note = resolutionNote.trim();
  if (note.length < 10) return null;
  return { resolutionNote: note };
}

async function escalationsRequest<T>(
  baseUrl: string,
  path: string,
  auth: GatewayAuthOptions | undefined,
  label: string,
  parse: (payload: unknown) => T,
): Promise<T> {
  const response = await fetch(
    buildAivaUrl(baseUrl, path),
    mergeGatewayInit(auth, {
      method: 'GET',
      headers: { Accept: 'application/json' },
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

export async function listOpenEscalations(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<AivaEscalationsList> {
  try {
    const escalations = await escalationsRequest(
      baseUrl,
      '/api/aiva/escalations',
      auth,
      'Aiva escalations',
      parseEscalationsList,
    );
    return {
      escalations,
      planGate: { required: false, planTier: null, planRequired: null, message: null },
    };
  } catch (err) {
    if (isPlanUpgradeError(err)) {
      return {
        escalations: [],
        planGate: planGateFromError(err),
      };
    }
    throw err;
  }
}

export { isPlanUpgradeError, planGateFromError };
