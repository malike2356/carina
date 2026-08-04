import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';

export type AivaSchedulePreset = 'daily' | 'weekly' | 'monthly' | 'interval_30' | 'custom';

export interface AivaAutomation {
  id: string;
  workerId: string;
  name: string;
  description: string;
  scheduleLabel: string;
  enabled: boolean;
  lastRunAt: string | null;
  triggerType: string | null;
  actionType: string | null;
  approvalMode: string | null;
  nextRunAt: string | null;
}

export interface AivaAutomationRun {
  id: string;
  automationId: string;
  status: string;
  triggerKind: string;
  error: string | null;
  durationMs: number | null;
  approvalStatus: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface CreateAutomationInput {
  name: string;
  description: string;
  triggerKind: 'schedule' | 'event';
  schedulePreset?: AivaSchedulePreset;
  scheduleText?: string;
  triggerEvent?: string;
  actionType?: string;
  approvalMode?: string;
  webhookUrl?: string;
}

export interface PlanGateInfo {
  required: boolean;
  planTier: string | null;
  planRequired: 'team' | 'business' | null;
  message: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function isPlanUpgradeError(err: unknown): boolean {
  return err instanceof AivaApiError && err.code === 'PLAN_UPGRADE_REQUIRED';
}

export function planGateFromError(err: unknown): PlanGateInfo {
  if (!(err instanceof AivaApiError) || err.code !== 'PLAN_UPGRADE_REQUIRED') {
    return { required: false, planTier: null, planRequired: null, message: null };
  }
  let planTier: string | null = null;
  let planRequired: 'team' | 'business' | null = null;
  try {
    const body = JSON.parse(err.body) as { planTier?: string; planRequired?: string };
    planTier = typeof body.planTier === 'string' ? body.planTier : null;
    planRequired =
      body.planRequired === 'team' || body.planRequired === 'business'
        ? body.planRequired
        : 'team';
  } catch {
    planRequired = 'team';
  }
  return {
    required: true,
    planTier,
    planRequired,
    message: err.message,
  };
}

export function buildSchedulePayload(
  preset: AivaSchedulePreset,
): Record<string, unknown> | null {
  if (preset === 'custom') return null;
  if (preset === 'interval_30') return { type: 'interval', everyMinutes: 30 };
  if (preset === 'daily') return { type: 'daily', atHour: 9, atMinute: 0 };
  if (preset === 'weekly') return { type: 'weekly', weekday: 1, atHour: 9, atMinute: 0 };
  if (preset === 'monthly') return { type: 'monthly', day: 1, atHour: 9, atMinute: 0 };
  return { type: 'daily', atHour: 9, atMinute: 0 };
}

export function validateCreateAutomationInput(input: CreateAutomationInput): string | null {
  if (!input.name.trim() || !input.description.trim()) {
    return 'Name and description are required.';
  }
  if (input.triggerKind === 'schedule') {
    const preset = input.schedulePreset ?? 'daily';
    if (preset === 'custom' && !input.scheduleText?.trim()) {
      return 'Custom schedule text is required.';
    }
  }
  if (input.triggerKind === 'event' && !input.triggerEvent?.trim()) {
    return 'Event source is required.';
  }
  if (input.actionType === 'webhook_call' && !input.webhookUrl?.trim()) {
    return 'Webhook URL is required.';
  }
  return null;
}

export function buildCreateAutomationBody(input: CreateAutomationInput): Record<string, unknown> {
  const actionType = input.actionType ?? 'aiva_prompt';
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    description: input.description.trim(),
    triggerKind: input.triggerKind,
    actionType,
    approvalMode: input.approvalMode ?? 'require_write',
    action:
      actionType === 'webhook_call'
        ? { type: 'webhook_call', url: input.webhookUrl?.trim(), method: 'POST' }
        : actionType === 'playbook'
          ? { type: 'playbook' }
          : { type: 'aiva_prompt', prompt: input.description.trim() },
  };

  if (input.triggerKind === 'event') {
    body.triggerEvent = input.triggerEvent?.trim() || 'email_received';
  } else {
    const schedule = buildSchedulePayload(input.schedulePreset ?? 'daily');
    if (schedule) body.schedule = schedule;
    else body.scheduleText = input.scheduleText?.trim();
  }

  return body;
}

export function parseAivaAutomation(raw: unknown): AivaAutomation | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    workerId: asString(row.workerId),
    name: asString(row.name, 'Automation'),
    description: asString(row.description),
    scheduleLabel: asString(row.scheduleLabel, 'Manual'),
    enabled: Boolean(row.enabled),
    lastRunAt: asString(row.lastRunAt) || null,
    triggerType: asString(row.triggerType) || null,
    actionType: asString(row.actionType) || null,
    approvalMode: asString(row.approvalMode) || null,
    nextRunAt: asString(row.nextRunAt) || null,
  };
}

export function parseAutomationsList(payload: unknown): AivaAutomation[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.automations) ? root.automations : [];
  return list
    .map((item) => parseAivaAutomation(item))
    .filter((item): item is AivaAutomation => item !== null);
}

export function parseAutomationRun(raw: unknown): AivaAutomationRun | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    automationId: asString(row.automationId),
    status: asString(row.status, 'unknown'),
    triggerKind: asString(row.triggerKind),
    error: asString(row.error) || null,
    durationMs: typeof row.durationMs === 'number' ? row.durationMs : null,
    approvalStatus: asString(row.approvalStatus) || null,
    createdAt: asString(row.createdAt),
    finishedAt: asString(row.finishedAt) || null,
  };
}

export function parseAutomationRuns(payload: unknown): AivaAutomationRun[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.runs) ? root.runs : [];
  return list
    .map((item) => parseAutomationRun(item))
    .filter((item): item is AivaAutomationRun => item !== null);
}

async function automationsRequest<T>(
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

export function listWorkerAutomations(
  baseUrl: string,
  workerId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaAutomation[]> {
  return automationsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/automations`,
    auth,
    undefined,
    'Aiva automations',
    parseAutomationsList,
  );
}

export function createWorkerAutomation(
  baseUrl: string,
  workerId: string,
  input: CreateAutomationInput,
  auth?: GatewayAuthOptions,
): Promise<AivaAutomation> {
  const validation = validateCreateAutomationInput(input);
  if (validation) {
    throw new AivaApiError(400, validation);
  }
  return automationsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/automations`,
    auth,
    {
      method: 'POST',
      body: JSON.stringify(buildCreateAutomationBody(input)),
    },
    'Aiva create automation',
    (payload) => {
      const root = asRecord(payload);
      const automation = parseAivaAutomation(root?.automation ?? payload);
      if (!automation) throw new AivaApiError(500, 'Automation payload missing id');
      return automation;
    },
  );
}

export function toggleWorkerAutomation(
  baseUrl: string,
  workerId: string,
  automationId: string,
  enabled: boolean,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return automationsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/automations/${encodeURIComponent(automationId)}`,
    auth,
    { method: 'PATCH', body: JSON.stringify({ enabled }) },
    'Aiva toggle automation',
    () => ({ ok: true }),
  );
}

export function listAutomationRuns(
  baseUrl: string,
  workerId: string,
  automationId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaAutomationRun[]> {
  return automationsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/automations/${encodeURIComponent(automationId)}/runs`,
    auth,
    undefined,
    'Aiva automation runs',
    parseAutomationRuns,
  );
}

export function testWorkerAutomation(
  baseUrl: string,
  workerId: string,
  automationId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaAutomationRun | null> {
  return automationsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/automations/${encodeURIComponent(automationId)}/test`,
    auth,
    { method: 'POST', body: JSON.stringify({ payload: { test: true } }) },
    'Aiva test automation',
    (payload) => {
      const root = asRecord(payload);
      return parseAutomationRun(root?.run ?? payload);
    },
  );
}

export function approveAutomationRun(
  baseUrl: string,
  workerId: string,
  runId: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return automationsRequest(
    baseUrl,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/automations/runs/${encodeURIComponent(runId)}/approve`,
    auth,
    { method: 'POST', body: '{}' },
    'Aiva approve run',
    () => ({ ok: true }),
  );
}
