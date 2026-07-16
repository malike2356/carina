import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

function formatBillingError(label: string, status: number, body: string, statusText: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('self.__next_f')) {
    return `${label} ${status}: endpoint missing or returned HTML instead of JSON.`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = parsed.error ?? parsed.message;
    if (msg) return `${label} ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  const short = trimmed.length > 180 ? `${trimmed.slice(0, 180)}...` : trimmed;
  return `${label} ${status}: ${short || statusText}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface AivaPrepaidPack {
  id: string;
  label: string;
  amountGbp: number;
  messages: number;
}

export interface AivaWalletView {
  remainingPence: number;
  remainingGbp: number;
  trialGrantedPence: number;
  purchasedPence: number;
  debitedPence: number;
  lowCredit: boolean;
  exhausted: boolean;
  byokActive: boolean;
}

export interface AivaAgentLimitsView {
  period: string;
  maxCalls: number | null;
  maxTokens: number | null;
  usedCalls: number;
  usedTokens: number;
  remainingCalls: number | null;
  remainingTokens: number | null;
  custom: boolean;
}

export type AivaSoftWallAction = 'byok' | 'topup' | 'upgrade' | 'mini_llm';

export interface AivaBillingStatusView {
  planTier: string;
  status: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  softWall: boolean;
  wallet: AivaWalletView | null;
  agentLimits: AivaAgentLimitsView | null;
  prepaidRemainingMessages: number;
  prepaidRemainingGbp: number;
  packs: AivaPrepaidPack[];
  softWallActions: AivaSoftWallAction[];
  messageCount: number;
  messageLimit: number | null;
}

export function mapAivaBillingStatus(payload: unknown): AivaBillingStatusView {
  const root = asRecord(payload) ?? {};
  const subscription = asRecord(root.subscription) ?? root;
  const usage = asRecord(root.usage) ?? {};
  const walletRaw = asRecord(root.wallet);
  const limitsRaw = asRecord(root.agentLimits);
  const prepaidRaw = asRecord(root.prepaid) ?? {};

  const planTier = String(subscription.planTier ?? root.planTier ?? 'trial');
  const status = String(subscription.status ?? root.status ?? 'unknown');
  const trialDaysRemaining =
    typeof subscription.trialDaysRemaining === 'number'
      ? subscription.trialDaysRemaining
      : typeof root.trialDaysRemaining === 'number'
        ? root.trialDaysRemaining
        : null;
  const trialEndsAt =
    typeof subscription.trialEndsAt === 'string'
      ? subscription.trialEndsAt
      : typeof root.trialEndsAt === 'string'
        ? root.trialEndsAt
        : null;

  const byokActive = Boolean(subscription.byokActive ?? root.byokActive);
  const prepaidRemainingMessages = Math.max(0, Number(prepaidRaw.remainingMessages ?? 0));
  const prepaidRemainingGbp = Math.max(0, Number(prepaidRaw.remainingGbp ?? 0));

  let wallet: AivaWalletView | null = null;
  if (walletRaw || usage.walletRemainingPence !== undefined || usage.walletRemainingGbp !== undefined) {
    const remainingPence = Math.max(
      0,
      Number(
        walletRaw?.remainingPence
          ?? usage.walletRemainingPence
          ?? subscription.walletRemainingPence
          ?? 0,
      ),
    );
    wallet = {
      remainingPence,
      remainingGbp: Math.max(
        0,
        Number(walletRaw?.remainingGbp ?? usage.walletRemainingGbp ?? remainingPence / 100),
      ),
      trialGrantedPence: Math.max(0, Number(walletRaw?.trialGrantedPence ?? 0)),
      purchasedPence: Math.max(0, Number(walletRaw?.purchasedPence ?? 0)),
      debitedPence: Math.max(0, Number(walletRaw?.debitedPence ?? 0)),
      lowCredit: Boolean(walletRaw?.lowCredit ?? usage.walletLowCredit),
      exhausted: Boolean(walletRaw?.exhausted ?? usage.walletExhausted),
      byokActive,
    };
  }

  let agentLimits: AivaAgentLimitsView | null = null;
  if (limitsRaw) {
    agentLimits = {
      period: String(limitsRaw.period ?? 'month'),
      maxCalls: typeof limitsRaw.maxCalls === 'number' ? limitsRaw.maxCalls : null,
      maxTokens: typeof limitsRaw.maxTokens === 'number' ? limitsRaw.maxTokens : null,
      usedCalls: Number(limitsRaw.usedCalls ?? 0),
      usedTokens: Number(limitsRaw.usedTokens ?? 0),
      remainingCalls:
        typeof limitsRaw.remainingCalls === 'number' ? limitsRaw.remainingCalls : null,
      remainingTokens:
        typeof limitsRaw.remainingTokens === 'number' ? limitsRaw.remainingTokens : null,
      custom: Boolean(limitsRaw.custom),
    };
  }

  const packs: AivaPrepaidPack[] = Array.isArray(prepaidRaw.packs)
    ? (prepaidRaw.packs as unknown[])
        .map((pack) => {
          const row = asRecord(pack);
          if (!row || !row.id) return null;
          return {
            id: String(row.id),
            label: String(row.label ?? row.id),
            amountGbp: Number(row.amountGbp ?? 0),
            messages: Number(row.messages ?? 0),
          };
        })
        .filter((pack): pack is AivaPrepaidPack => pack !== null)
    : [];
  const apiActions = Array.isArray(subscription.softWallActions ?? root.softWallActions)
    ? ((subscription.softWallActions ?? root.softWallActions) as unknown[])
        .filter((action): action is AivaSoftWallAction =>
          action === 'byok'
          || action === 'topup'
          || action === 'upgrade'
          || action === 'mini_llm',
        )
    : null;

  const softWallFromApi =
    typeof subscription.softWall === 'boolean'
      ? subscription.softWall
      : typeof root.softWall === 'boolean'
        ? root.softWall
        : null;

  const trialEnded = status === 'trial_ended' || (status === 'suspended' && planTier === 'trial');
  const walletExhausted = wallet?.exhausted === true;
  const softWall =
    softWallFromApi
    ?? ((trialEnded || walletExhausted)
      && prepaidRemainingMessages <= 0
      && !byokActive);

  return {
    planTier,
    status,
    trialEndsAt,
    trialDaysRemaining,
    softWall,
    wallet,
    agentLimits,
    prepaidRemainingMessages,
    prepaidRemainingGbp,
    packs,
    softWallActions: apiActions ?? resolveSoftWallActions({
      softWall,
      byokActive,
      packsAvailable: packs.length > 0,
    }),
    messageCount: Number(usage.messageCount ?? root.count ?? 0),
    messageLimit:
      usage.messageLimit === null || usage.messageLimit === undefined
        ? null
        : Number(usage.messageLimit),
  };
}

export function resolveSoftWallActions(input: {
  softWall: boolean;
  byokActive: boolean;
  packsAvailable: boolean;
}): AivaSoftWallAction[] {
  if (!input.softWall) return [];
  const actions: AivaSoftWallAction[] = ['byok', 'upgrade'];
  if (input.packsAvailable) {
    actions.splice(1, 0, 'topup');
  }
  actions.push('mini_llm');
  return actions;
}

async function billingJsonRequest<T>(
  baseUrl: string,
  path: string,
  auth: GatewayAuthOptions | undefined,
  init: RequestInit | undefined,
  label: string,
  parse: (payload: unknown) => T,
): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}${path}`,
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
    throw new Error(formatBillingError(label, response.status, text, response.statusText));
  }
  if (!text.trim()) {
    throw new Error(`${label}: empty response`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label}: server returned non-JSON body`);
  }
  return parse(payload);
}

export function fetchAivaBillingStatus(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<AivaBillingStatusView> {
  return billingJsonRequest(
    baseUrl,
    '/api/aiva/billing/status',
    auth,
    undefined,
    'Aiva billing status',
    mapAivaBillingStatus,
  );
}

export async function openAivaBillingPortal(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<string> {
  const data = await billingJsonRequest<{ url?: string }>(
    baseUrl,
    '/api/aiva/billing/portal',
    auth,
    { method: 'POST', body: '{}' },
    'Aiva billing portal',
    (payload) => asRecord(payload) as { url?: string },
  );
  if (!data.url) throw new Error('No Aiva billing portal URL returned');
  return data.url;
}

export async function startAivaCheckout(
  baseUrl: string,
  tier: 'starter' | 'growth' | 'team' | 'business',
  auth?: GatewayAuthOptions,
): Promise<string> {
  const origin = baseUrl.replace(/\/+$/, '');
  const data = await billingJsonRequest<{ url?: string }>(
    baseUrl,
    '/api/aiva/billing/checkout',
    auth,
    {
      method: 'POST',
      body: JSON.stringify({
        tier,
        interval: 'month',
        successUrl: `${origin}/billing/aiva?checkout=success`,
        cancelUrl: `${origin}/billing/aiva?checkout=cancel`,
      }),
    },
    'Aiva checkout',
    (payload) => asRecord(payload) as { url?: string },
  );
  if (!data.url) throw new Error('No Aiva checkout URL returned');
  return data.url;
}

export async function startAivaTopup(
  baseUrl: string,
  packId: string,
  auth?: GatewayAuthOptions,
): Promise<string> {
  const origin = baseUrl.replace(/\/+$/, '');
  const data = await billingJsonRequest<{ url?: string }>(
    baseUrl,
    '/api/aiva/billing/topup',
    auth,
    {
      method: 'POST',
      body: JSON.stringify({
        packId,
        successUrl: `${origin}/billing/aiva?topup=success`,
        cancelUrl: `${origin}/billing/aiva?topup=cancel`,
      }),
    },
    'Aiva top-up',
    (payload) => asRecord(payload) as { url?: string },
  );
  if (!data.url) throw new Error('No Aiva top-up URL returned');
  return data.url;
}
