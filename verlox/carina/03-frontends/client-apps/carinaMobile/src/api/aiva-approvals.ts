import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';

export type AivaApprovalKind = 'email' | 'social';

export interface AivaEmailApproval {
  id: string;
  kind: 'email';
  workerId: string;
  workerName: string | null;
  category: string;
  recipient: string;
  subject: string;
  draftBody: string;
  originalFrom: string | null;
  requestedAt: string;
  timeoutAt: string;
}

export interface AivaSocialApproval {
  id: string;
  kind: 'social';
  workerId: string;
  workerName: string | null;
  channel: string;
  contactId: string;
  conversationId: string | null;
  inboundText: string | null;
  draftText: string;
  messageType: string | null;
  scheduledFor: string | null;
  requestedAt: string;
  timeoutAt: string;
}

export type AivaApprovalItem = AivaEmailApproval | AivaSocialApproval;

export interface AivaInboxRow {
  id: string;
  kind: AivaApprovalKind;
  typeLabel: string;
  title: string;
  preview: string;
  workerName: string;
  requestedAt: string;
  ageLabel: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

async function approvalsRequest<T>(
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
    throw new AivaApiError(response.status, `${label}: server returned non-JSON body`, {
      body: text,
    });
  }
  return parse(payload);
}

export function parseAivaEmailApproval(
  raw: unknown,
  workerNames?: Map<string, string>,
): AivaEmailApproval | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  const workerId = asString(row.workerId);
  return {
    id,
    kind: 'email',
    workerId,
    workerName: workerNames?.get(workerId) ?? null,
    category: asString(row.category, 'email'),
    recipient: asString(row.recipient),
    subject: asString(row.subject, '(no subject)'),
    draftBody: asString(row.draftBody),
    originalFrom: asString(row.originalFrom) || null,
    requestedAt: asString(row.requestedAt),
    timeoutAt: asString(row.timeoutAt),
  };
}

export function parseAivaSocialApproval(raw: unknown): AivaSocialApproval | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    kind: 'social',
    workerId: asString(row.workerId),
    workerName: asString(row.workerName) || null,
    channel: asString(row.channel, 'social'),
    contactId: asString(row.contactId),
    conversationId: asString(row.conversationId) || null,
    inboundText: asString(row.inboundText) || null,
    draftText: asString(row.draftText),
    messageType: asString(row.messageType) || null,
    scheduledFor: asString(row.scheduledFor) || null,
    requestedAt: asString(row.requestedAt),
    timeoutAt: asString(row.timeoutAt),
  };
}

export function parseEmailApprovalsInbox(
  payload: unknown,
  workerNames?: Map<string, string>,
): AivaEmailApproval[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.approvals) ? root.approvals : [];
  return list
    .map((item) => parseAivaEmailApproval(item, workerNames))
    .filter((item): item is AivaEmailApproval => item !== null);
}

export function parseSocialApprovalsInbox(payload: unknown): AivaSocialApproval[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.approvals) ? root.approvals : [];
  return list
    .map((item) => parseAivaSocialApproval(item))
    .filter((item): item is AivaSocialApproval => item !== null);
}

export function formatApprovalAge(requestedAt: string, nowMs = Date.now()): string {
  const ms = Date.parse(requestedAt);
  if (!Number.isFinite(ms)) return '';
  const deltaSec = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (deltaSec < 60) return 'Just now';
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86400)}d ago`;
}

export function mapApprovalToInboxRow(
  item: AivaApprovalItem,
  nowMs = Date.now(),
): AivaInboxRow {
  if (item.kind === 'email') {
    return {
      id: item.id,
      kind: 'email',
      typeLabel: 'Email',
      title: item.subject,
      preview: item.draftBody.slice(0, 140),
      workerName: item.workerName ?? 'AI employee',
      requestedAt: item.requestedAt,
      ageLabel: formatApprovalAge(item.requestedAt, nowMs),
    };
  }
  return {
    id: item.id,
    kind: 'social',
    typeLabel: item.channel || 'Social',
    title: item.draftText.slice(0, 80) || 'Social draft',
    preview: item.inboundText?.slice(0, 140) || item.draftText.slice(0, 140),
    workerName: item.workerName ?? 'AI employee',
    requestedAt: item.requestedAt,
    ageLabel: formatApprovalAge(item.requestedAt, nowMs),
  };
}

export function mergeApprovalInboxes(
  email: AivaEmailApproval[],
  social: AivaSocialApproval[],
): AivaApprovalItem[] {
  return [...email, ...social].sort((a, b) => {
    const aMs = Date.parse(a.requestedAt) || 0;
    const bMs = Date.parse(b.requestedAt) || 0;
    return bMs - aMs;
  });
}

export function createApprovalSubmitGuard() {
  const inflight = new Set<string>();
  return {
    tryBegin(key: string): boolean {
      if (inflight.has(key)) return false;
      inflight.add(key);
      return true;
    },
    end(key: string): void {
      inflight.delete(key);
    },
    has(key: string): boolean {
      return inflight.has(key);
    },
  };
}

export type ApprovalSubmitGuard = ReturnType<typeof createApprovalSubmitGuard>;

export function applyOptimisticRemove(
  items: AivaApprovalItem[],
  id: string,
): AivaApprovalItem[] {
  return items.filter((item) => item.id !== id);
}

export function rollbackApprovalList(
  current: AivaApprovalItem[],
  previous: AivaApprovalItem[],
): AivaApprovalItem[] {
  return previous;
}

export function listEmailApprovals(
  baseUrl: string,
  auth?: GatewayAuthOptions,
  workerNames?: Map<string, string>,
): Promise<AivaEmailApproval[]> {
  return approvalsRequest(
    baseUrl,
    '/api/aiva/email/approvals/inbox',
    auth,
    undefined,
    'Email approvals',
    (payload) => parseEmailApprovalsInbox(payload, workerNames),
  );
}

export function listSocialApprovals(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<AivaSocialApproval[]> {
  return approvalsRequest(
    baseUrl,
    '/api/aiva/social/approvals/inbox',
    auth,
    undefined,
    'Social approvals',
    parseSocialApprovalsInbox,
  );
}

export async function listCombinedApprovals(
  baseUrl: string,
  auth?: GatewayAuthOptions,
  workerNames?: Map<string, string>,
): Promise<AivaApprovalItem[]> {
  const [emailResult, socialResult] = await Promise.allSettled([
    listEmailApprovals(baseUrl, auth, workerNames),
    listSocialApprovals(baseUrl, auth),
  ]);

  const email = emailResult.status === 'fulfilled' ? emailResult.value : [];
  const social = socialResult.status === 'fulfilled' ? socialResult.value : [];

  if (emailResult.status === 'rejected' && socialResult.status === 'rejected') {
    throw emailResult.reason instanceof Error
      ? emailResult.reason
      : new Error(String(emailResult.reason));
  }

  return mergeApprovalInboxes(email, social);
}

export async function fetchApprovalsPendingCount(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<number> {
  const [socialCount, emailList] = await Promise.allSettled([
    approvalsRequest(
      baseUrl,
      '/api/aiva/social/approvals/pending-count',
      auth,
      undefined,
      'Social pending count',
      (payload) => {
        const root = asRecord(payload);
        return typeof root?.count === 'number' ? root.count : 0;
      },
    ),
    listEmailApprovals(baseUrl, auth).catch(() => [] as AivaEmailApproval[]),
  ]);

  const social = socialCount.status === 'fulfilled' ? socialCount.value : 0;
  const email = emailList.status === 'fulfilled' ? emailList.value.length : 0;
  return social + email;
}

export function approveEmailApproval(
  baseUrl: string,
  approvalId: string,
  auth?: GatewayAuthOptions,
  modifiedBody?: string,
): Promise<{ ok: boolean }> {
  return approvalsRequest(
    baseUrl,
    `/api/aiva/email/approvals/${encodeURIComponent(approvalId)}/approve`,
    auth,
    {
      method: 'POST',
      body: JSON.stringify(modifiedBody ? { modifiedBody } : {}),
    },
    'Email approve',
    () => ({ ok: true }),
  );
}

export function rejectEmailApproval(
  baseUrl: string,
  approvalId: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return approvalsRequest(
    baseUrl,
    `/api/aiva/email/approvals/${encodeURIComponent(approvalId)}/reject`,
    auth,
    { method: 'POST', body: '{}' },
    'Email reject',
    () => ({ ok: true }),
  );
}

export function approveSocialApproval(
  baseUrl: string,
  approvalId: string,
  auth?: GatewayAuthOptions,
  modifiedBody?: string,
): Promise<{ ok: boolean }> {
  return approvalsRequest(
    baseUrl,
    `/api/aiva/social/approvals/${encodeURIComponent(approvalId)}/approve`,
    auth,
    {
      method: 'POST',
      body: JSON.stringify(modifiedBody ? { modifiedBody } : {}),
    },
    'Social approve',
    () => ({ ok: true }),
  );
}

export function rejectSocialApproval(
  baseUrl: string,
  approvalId: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean }> {
  return approvalsRequest(
    baseUrl,
    `/api/aiva/social/approvals/${encodeURIComponent(approvalId)}/reject`,
    auth,
    { method: 'POST', body: '{}' },
    'Social reject',
    () => ({ ok: true }),
  );
}

export async function decideApproval(
  baseUrl: string,
  item: Pick<AivaApprovalItem, 'id' | 'kind'>,
  decision: 'approve' | 'reject',
  auth?: GatewayAuthOptions,
  modifiedBody?: string,
): Promise<{ ok: boolean }> {
  if (item.kind === 'email') {
    return decision === 'approve'
      ? approveEmailApproval(baseUrl, item.id, auth, modifiedBody)
      : rejectEmailApproval(baseUrl, item.id, auth);
  }
  return decision === 'approve'
    ? approveSocialApproval(baseUrl, item.id, auth, modifiedBody)
    : rejectSocialApproval(baseUrl, item.id, auth);
}
