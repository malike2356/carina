import type { EventEntity } from '@paddle/paddle-node-sdk';
import type { CustomData } from '@paddle/paddle-node-sdk';
import {
  getPaddleSubscriptionByPaddleId,
  reactivatePaddleWorkspace,
  suspendPaddleWorkspace,
  upsertPaddleSubscription,
} from './paddle-subscription-store.js';

function workspaceIdFromCustomData(customData: CustomData | null | undefined): string | null {
  if (!customData || typeof customData !== 'object') return null;
  const record = customData as Record<string, unknown>;
  const id = record.workspaceId ?? record.workspace_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function resolveWorkspaceId(
  customData: CustomData | null | undefined,
  paddleSubscriptionId?: string | null,
): Promise<string | null> {
  const fromCustom = workspaceIdFromCustomData(customData);
  if (fromCustom) return fromCustom;
  if (!paddleSubscriptionId) return null;
  const existing = await getPaddleSubscriptionByPaddleId(paddleSubscriptionId);
  return existing?.workspaceId ?? null;
}

async function handleSubscriptionUpsert(data: EventEntity['data']): Promise<void> {
  const subscription = data as {
    id?: string;
    customerId?: string;
    status?: string;
    customData?: CustomData | null;
    currentBillingPeriod?: { endsAt?: string | null } | null;
    canceledAt?: string | null;
  };
  const workspaceId = await resolveWorkspaceId(subscription.customData, subscription.id);
  if (!workspaceId) return;

  await upsertPaddleSubscription({
    workspaceId,
    paddleSubscriptionId: subscription.id ?? null,
    paddleCustomerId: subscription.customerId ?? null,
    planTier: 'business',
    status: subscription.status === 'active' ? 'active' : String(subscription.status ?? 'active'),
    currentPeriodEnd: subscription.currentBillingPeriod?.endsAt ?? null,
    canceledAt: subscription.canceledAt ?? null,
  });
}

async function handleSubscriptionCanceled(data: EventEntity['data']): Promise<void> {
  const subscription = data as { customData?: CustomData | null; id?: string };
  const workspaceId = await resolveWorkspaceId(subscription.customData, subscription.id);
  if (!workspaceId) return;
  await suspendPaddleWorkspace(workspaceId);
}

async function handleSubscriptionPastDue(data: EventEntity['data']): Promise<void> {
  const subscription = data as { customData?: CustomData | null; id?: string };
  const workspaceId = await resolveWorkspaceId(subscription.customData, subscription.id);
  if (!workspaceId) return;
  await suspendPaddleWorkspace(workspaceId);
}

async function handleSubscriptionResumed(data: EventEntity['data']): Promise<void> {
  const subscription = data as { customData?: CustomData | null; id?: string };
  const workspaceId = await resolveWorkspaceId(subscription.customData, subscription.id);
  if (!workspaceId) return;
  await reactivatePaddleWorkspace(workspaceId);
}

async function handleTransactionCompleted(data: EventEntity['data']): Promise<void> {
  const transaction = data as {
    customData?: CustomData | null;
    subscriptionId?: string | null;
  };
  const workspaceId = await resolveWorkspaceId(transaction.customData, transaction.subscriptionId);
  if (!workspaceId) return;
  await reactivatePaddleWorkspace(workspaceId);
}

async function handleTransactionFailed(data: EventEntity['data']): Promise<void> {
  const transaction = data as {
    customData?: CustomData | null;
    subscriptionId?: string | null;
  };
  const workspaceId = await resolveWorkspaceId(transaction.customData, transaction.subscriptionId);
  if (!workspaceId) return;
  await suspendPaddleWorkspace(workspaceId);
}

export async function handlePaddleEvent(event: EventEntity): Promise<void> {
  switch (event.eventType) {
    case 'subscription.created':
    case 'subscription.updated':
      return handleSubscriptionUpsert(event.data);
    case 'subscription.canceled':
      return handleSubscriptionCanceled(event.data);
    case 'subscription.past_due':
    case 'subscription.paused':
      return handleSubscriptionPastDue(event.data);
    case 'subscription.resumed':
      return handleSubscriptionResumed(event.data);
    case 'transaction.completed':
      return handleTransactionCompleted(event.data);
    case 'transaction.payment_failed':
      return handleTransactionFailed(event.data);
    default:
      return;
  }
}
