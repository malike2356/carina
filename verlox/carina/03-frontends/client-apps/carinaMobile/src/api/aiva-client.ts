import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

export type AivaWorkerStatus =
  | 'active'
  | 'paused'
  | 'error'
  | 'dismissed'
  | 'suspended_by_scout'
  | string;

export interface AivaWorkerSummary {
  id: string;
  workspaceId: string;
  name: string;
  roleDescription: string;
  status: AivaWorkerStatus;
  channels: string[];
  language: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AivaWorkerDetail extends AivaWorkerSummary {
  messagesToday?: number;
  totalMessages?: number;
  lastActiveAt?: string | null;
  pendingApprovals?: number;
  openEscalations?: number;
}

export interface AivaWorkersListResponse {
  workers: AivaWorkerSummary[];
}

export interface AivaWorkerDetailResponse {
  worker: AivaWorkerDetail;
}

export interface AivaEmployeeMessage {
  id: string;
  threadId: string;
  sender: 'user' | 'employee' | 'system' | string;
  content: string;
  createdAt: string;
}

export interface AivaEmployeeTask {
  id: string;
  title: string;
  instructions: string;
  priority: string;
  status: string;
  dueAt: string | null;
  completedWork: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AivaSubscriptionStatus {
  planTier: string;
  status: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  slotLimit: number;
  aivasUsed: number;
  canHireMore: boolean;
  pendingChannelActivation?: boolean;
  softWall?: boolean;
  walletRemainingGbp?: number;
  walletExhausted?: boolean;
  byokActive?: boolean;
  allowedToolsets?: string[];
  toolCount?: number;
  [key: string]: unknown;
}

export class AivaApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly body: string;

  constructor(status: number, message: string, options?: { code?: string | null; body?: string }) {
    super(message);
    this.name = 'AivaApiError';
    this.status = status;
    this.code = options?.code ?? null;
    this.body = options?.body ?? '';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export function normalizeAivaBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function buildAivaUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeAivaBaseUrl(baseUrl)}${normalizedPath}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asIsoOrNull(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function parseAivaWorkerSummary(raw: unknown): AivaWorkerSummary | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    workspaceId: asString(row.workspaceId ?? row.workspace_id),
    name: asString(row.name, 'Untitled employee'),
    roleDescription: asString(row.roleDescription ?? row.role_description),
    status: asString(row.status, 'active'),
    channels: asStringArray(row.channels),
    language: asString(row.language, 'en-GB'),
    createdAt: asIsoOrNull(row.createdAt ?? row.created_at),
    updatedAt: asIsoOrNull(row.updatedAt ?? row.updated_at),
  };
}

export function parseAivaWorkersList(payload: unknown): AivaWorkerSummary[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.workers)
      ? root.workers
      : [];
  return list
    .map((item) => parseAivaWorkerSummary(item))
    .filter((item): item is AivaWorkerSummary => item !== null);
}

export function parseAivaWorkerDetail(payload: unknown): AivaWorkerDetail {
  const root = asRecord(payload);
  const raw = root?.worker ?? payload;
  const summary = parseAivaWorkerSummary(raw);
  if (!summary) {
    throw new AivaApiError(500, 'Aiva API: worker payload missing id');
  }
  const detail = asRecord(raw) ?? {};
  return {
    ...summary,
    messagesToday: typeof detail.messagesToday === 'number' ? detail.messagesToday : undefined,
    totalMessages: typeof detail.totalMessages === 'number' ? detail.totalMessages : undefined,
    lastActiveAt: asIsoOrNull(detail.lastActiveAt),
    pendingApprovals:
      typeof detail.pendingApprovals === 'number' ? detail.pendingApprovals : undefined,
    openEscalations:
      typeof detail.openEscalations === 'number' ? detail.openEscalations : undefined,
  };
}

export function parseAivaSubscriptionStatus(payload: unknown): AivaSubscriptionStatus {
  const root = asRecord(payload) ?? {};
  return {
    ...root,
    planTier: asString(root.planTier, 'trial'),
    status: asString(root.status, 'unknown'),
    trialEndsAt: asIsoOrNull(root.trialEndsAt),
    trialDaysRemaining:
      typeof root.trialDaysRemaining === 'number' ? root.trialDaysRemaining : null,
    slotLimit: typeof root.slotLimit === 'number' ? root.slotLimit : 0,
    aivasUsed: typeof root.aivasUsed === 'number' ? root.aivasUsed : 0,
    canHireMore: Boolean(root.canHireMore),
  };
}

export function formatAivaApiError(
  label: string,
  status: number,
  body: string,
  statusText: string,
): AivaApiError {
  const trimmed = body.trim();
  let message = `${label} ${status}: ${statusText || 'Request failed'}`;
  let code: string | null = null;

  if (!trimmed) {
    return new AivaApiError(status, message, { body });
  }

  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('self.__next_f')
  ) {
    return new AivaApiError(
      status,
      `${label} ${status}: server returned an HTML page instead of JSON.`,
      { body },
    );
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: string;
      message?: string;
      code?: string;
    };
    code = typeof parsed.code === 'string' ? parsed.code : null;
    const detail = parsed.message ?? parsed.error;
    if (detail) {
      message = `${label} ${status}: ${detail}`;
    }
  } catch {
    const short = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
    message = `${label} ${status}: ${short}`;
  }

  return new AivaApiError(status, message, { code, body });
}

async function aivaRequest<T>(
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
    throw new AivaApiError(response.status, `${label}: empty response`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new AivaApiError(
      response.status,
      `${label}: server returned non-JSON body`,
      { body: text },
    );
  }

  return parse(payload);
}

export function listAivaWorkers(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<AivaWorkerSummary[]> {
  return aivaRequest(
    baseUrl,
    '/api/aiva/workers',
    auth,
    undefined,
    'Aiva workers',
    parseAivaWorkersList,
  );
}

export function getAivaWorker(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaWorkerDetail> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}`,
    auth,
    undefined,
    'Aiva worker',
    parseAivaWorkerDetail,
  );
}

export function fetchAivaSubscriptionStatus(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<AivaSubscriptionStatus> {
  return aivaRequest(
    baseUrl,
    '/api/aiva/subscription/status',
    auth,
    undefined,
    'Aiva subscription',
    parseAivaSubscriptionStatus,
  );
}

export interface CreateAivaWorkerInput {
  roleName: string;
  roleDescription: string;
  channels: string[];
  language?: string;
  templateId?: string | null;
}

export function createAivaWorker(
  baseUrl: string,
  input: CreateAivaWorkerInput,
  auth?: GatewayAuthOptions,
): Promise<AivaWorkerDetail> {
  return aivaRequest(
    baseUrl,
    '/api/aiva/workers',
    auth,
    {
      method: 'POST',
      body: JSON.stringify({
        roleName: input.roleName,
        roleDescription: input.roleDescription,
        channels: input.channels,
        language: input.language ?? 'en-GB',
        templateId: input.templateId ?? null,
        usePlaybookTemplate: false,
      }),
    },
    'Aiva hire',
    parseAivaWorkerDetail,
  );
}

export interface PatchAivaWorkerInput {
  roleName?: string;
  roleDescription?: string;
  language?: string;
  status?: 'active' | 'paused';
}

export function patchAivaWorker(
  baseUrl: string,
  workerId: string,
  input: PatchAivaWorkerInput,
  auth?: GatewayAuthOptions,
): Promise<AivaWorkerDetail> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}`,
    auth,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    'Aiva worker update',
    parseAivaWorkerDetail,
  );
}

export function pauseAivaWorker(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaWorkerDetail> {
  return patchAivaWorker(baseUrl, workerId, { status: 'paused' }, auth);
}

export function resumeAivaWorker(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaWorkerDetail> {
  return patchAivaWorker(baseUrl, workerId, { status: 'active' }, auth);
}

export function dismissAivaWorker(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}`,
    auth,
    { method: 'DELETE' },
    'Aiva dismiss',
    (payload) => {
      const root = asRecord(payload);
      return { ok: root?.ok === false ? false : true };
    },
  );
}

export function listAivaEmployeeMessages(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaEmployeeMessage[]> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/employees/${encodeURIComponent(workerId)}/thread?limit=20`,
    auth,
    undefined,
    'Aiva employee messages',
    (payload) => {
      const root = asRecord(payload);
      const rows = Array.isArray(root?.messages) ? root.messages : [];
      return rows
        .map((row) => {
          const item = asRecord(row);
          if (!item?.id) return null;
          return {
            id: asString(item.id),
            threadId: asString(item.threadId),
            sender: asString(item.sender, 'system'),
            content: asString(item.content),
            createdAt: asIsoOrNull(item.createdAt) ?? new Date().toISOString(),
          };
        })
        .filter((item): item is AivaEmployeeMessage => item !== null);
    },
  );
}

export function sendAivaEmployeeMessage(
  baseUrl: string,
  workerId: string,
  content: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/employees/${encodeURIComponent(workerId)}/messages`,
    auth,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
    'Aiva employee message',
    () => ({ ok: true }),
  );
}

export function listAivaEmployeeTasks(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaEmployeeTask[]> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/employees/${encodeURIComponent(workerId)}/tasks?limit=20`,
    auth,
    undefined,
    'Aiva employee tasks',
    (payload) => {
      const root = asRecord(payload);
      const rows = Array.isArray(root?.tasks) ? root.tasks : [];
      return rows
        .map((row) => {
          const item = asRecord(row);
          if (!item?.id) return null;
          return {
            id: asString(item.id),
            title: asString(item.title, 'Untitled task'),
            instructions: asString(item.instructions),
            priority: asString(item.priority, 'normal'),
            status: asString(item.status, 'assigned'),
            dueAt: asIsoOrNull(item.dueAt),
            completedWork: typeof item.completedWork === 'string' ? item.completedWork : null,
            createdAt: asIsoOrNull(item.createdAt) ?? new Date().toISOString(),
            updatedAt: asIsoOrNull(item.updatedAt) ?? new Date().toISOString(),
          };
        })
        .filter((item): item is AivaEmployeeTask => item !== null);
    },
  );
}

export function assignAivaEmployeeTask(
  baseUrl: string,
  workerId: string,
  input: { title: string; instructions: string; priority?: string },
  auth?: GatewayAuthOptions,
): Promise<AivaEmployeeTask> {
  return aivaRequest(
    baseUrl,
    `/api/aiva/employees/${encodeURIComponent(workerId)}/tasks`,
    auth,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    'Aiva employee task',
    (payload) => {
      const root = asRecord(payload);
      const item = asRecord(root?.task);
      if (!item?.id) throw new AivaApiError(500, 'Aiva employee task: task payload missing id');
      return {
        id: asString(item.id),
        title: asString(item.title, 'Untitled task'),
        instructions: asString(item.instructions),
        priority: asString(item.priority, 'normal'),
        status: asString(item.status, 'assigned'),
        dueAt: asIsoOrNull(item.dueAt),
        completedWork: typeof item.completedWork === 'string' ? item.completedWork : null,
        createdAt: asIsoOrNull(item.createdAt) ?? new Date().toISOString(),
        updatedAt: asIsoOrNull(item.updatedAt) ?? new Date().toISOString(),
      };
    },
  );
}
