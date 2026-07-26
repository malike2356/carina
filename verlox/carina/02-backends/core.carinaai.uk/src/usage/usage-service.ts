import { pool } from '../memory/db.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import {
  firstWorkerName,
  sendUsageLimitReachedEmail,
  sendUsageWarningEmail,
} from '../email/email-triggers.js';
import { resolveConfigValue } from '../billing/billing-config.js';
import {
  debitAivaPrepaidMessage,
  getAivaPrepaidBalance,
} from '../billing/aiva-prepaid-store.js';
import {
  checkAivaWalletGate,
  debitAivaWalletUsage,
  getAivaWalletBalance,
  recordAivaByokUsage,
  type AivaWalletGateResult,
} from '../billing/aiva-ai-wallet.js';

/** Defaults when billing_config / env unset. Keep trial tiny (solopreneur-safe ~£1). */
export const MESSAGE_LIMITS_BY_TIER: Record<string, number> = {
  trial: 20,
  starter: 1000,
  team: 10000,
  business: Number.POSITIVE_INFINITY,
};

const DEFAULT_TRIAL_MESSAGES = 20;
const DEFAULT_TRIAL_CREDIT_GBP = 1;

export function resolveTrialMessageLimit(): number {
  const raw = resolveConfigValue('AIVA_TRIAL_MESSAGE_LIMIT').trim();
  if (!raw) return DEFAULT_TRIAL_MESSAGES;
  const n = Number(raw);
  if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 10_000) {
    return n;
  }
  return DEFAULT_TRIAL_MESSAGES;
}

export function resolveTrialCreditGbp(): number {
  const raw = resolveConfigValue('AIVA_TRIAL_CREDIT_GBP').trim();
  if (!raw) return DEFAULT_TRIAL_CREDIT_GBP;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 100) {
    return n;
  }
  return DEFAULT_TRIAL_CREDIT_GBP;
}

export function messageLimit(planTier: string): number {
  if (planTier === 'trial') {
    return resolveTrialMessageLimit();
  }
  return MESSAGE_LIMITS_BY_TIER[planTier] ?? DEFAULT_TRIAL_MESSAGES;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function incrementMessageCount(workspaceId: string): Promise<void> {
  const month = currentMonth();
  await pool.query(
    `INSERT INTO aiva_usage (workspace_id, month, message_count, updated_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (workspace_id, month)
     DO UPDATE SET message_count = aiva_usage.message_count + 1, updated_at = NOW()`,
    [workspaceId, month],
  );
}

export async function getCurrentUsage(workspaceId: string): Promise<{
  messageCount: number;
  month: string;
  warningSentAt: Date | null;
  limitReachedAt: Date | null;
}> {
  const month = currentMonth();
  const result = await pool.query(
    `SELECT message_count, warning_sent_at, limit_reached_at
     FROM aiva_usage WHERE workspace_id = $1 AND month = $2`,
    [workspaceId, month],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    messageCount: Number(row?.message_count ?? 0),
    month,
    warningSentAt: row?.warning_sent_at ? new Date(String(row.warning_sent_at)) : null,
    limitReachedAt: row?.limit_reached_at ? new Date(String(row.limit_reached_at)) : null,
  };
}

export type LimitEnforceResult = {
  allowed: boolean;
  messageCount: number;
  limit: number;
  planTier: string;
  usePrepaid?: boolean;
  walletMode?: AivaWalletGateResult['mode'];
  wallet?: AivaWalletGateResult;
  actions?: Array<'byok' | 'topup' | 'upgrade'>;
  reason?: string;
};

export async function checkAndEnforceLimit(workspaceId: string): Promise<LimitEnforceResult> {
  const sub = await getSubscription(workspaceId);
  const planTier = sub?.planTier ?? 'trial';
  const status = sub?.status ?? 'trialing';
  // Payment suspension stays hard. Trial soft wall can continue via wallet / prepaid / BYOK.
  if (status === 'suspended') {
    const usage = await getCurrentUsage(workspaceId);
    return {
      allowed: false,
      messageCount: usage.messageCount,
      limit: 0,
      planTier,
      actions: ['upgrade'],
      reason: 'subscription suspended',
    };
  }

  const isTrialSurface =
    planTier === 'trial' || status === 'trialing' || status === 'trial_ended' || status === 'pending_channel';

  const walletGate = await checkAivaWalletGate(workspaceId, {
    planTier,
    applyDailyCap: isTrialSurface,
  });

  if (status === 'trial_ended' || isTrialSurface) {
    const usage = await getCurrentUsage(workspaceId);
    const trialLimit = messageLimit(planTier);

    if (walletGate.mode === 'byok') {
      return {
        allowed: true,
        messageCount: usage.messageCount,
        limit: trialLimit,
        planTier,
        walletMode: 'byok',
        wallet: walletGate,
      };
    }
    if (walletGate.allowed && walletGate.mode === 'managed') {
      // Credit depletion wins the commercial gate; message cap remains a runaway belt.
      if (
        trialLimit !== Number.POSITIVE_INFINITY
        && usage.messageCount >= trialLimit
      ) {
        const prepaid = await getAivaPrepaidBalance(workspaceId);
        if (prepaid.remainingMessages > 0) {
          return {
            allowed: true,
            messageCount: usage.messageCount,
            limit: trialLimit,
            planTier,
            usePrepaid: true,
            walletMode: 'managed',
            wallet: walletGate,
          };
        }
        return {
          allowed: false,
          messageCount: usage.messageCount,
          limit: trialLimit,
          planTier,
          walletMode: 'denied',
          wallet: walletGate,
          actions: ['byok', 'topup', 'upgrade'],
          reason: 'trial message cap reached',
        };
      }
      return {
        allowed: true,
        messageCount: usage.messageCount,
        limit: trialLimit,
        planTier,
        walletMode: 'managed',
        wallet: walletGate,
      };
    }
    const prepaid = await getAivaPrepaidBalance(workspaceId);
    if (prepaid.remainingMessages > 0) {
      return {
        allowed: true,
        messageCount: usage.messageCount,
        limit: trialLimit,
        planTier,
        usePrepaid: true,
        walletMode: 'managed',
        wallet: walletGate,
      };
    }
    if (isTrialSurface) {
      if (!usage.limitReachedAt) {
        await pool.query(
          `UPDATE aiva_usage SET limit_reached_at = NOW(), updated_at = NOW()
           WHERE workspace_id = $1 AND month = $2`,
          [workspaceId, usage.month],
        );
      }
      return {
        allowed: false,
        messageCount: usage.messageCount,
        limit: trialLimit,
        planTier,
        walletMode: 'denied',
        wallet: walletGate,
        actions: walletGate.actions ?? ['byok', 'topup', 'upgrade'],
        reason: walletGate.reason ?? 'managed AI credit exhausted',
      };
    }
  }

  const limit = messageLimit(planTier);
  const usage = await getCurrentUsage(workspaceId);
  const walletBalance = await getAivaWalletBalance(workspaceId);

  // Paid managed plans: debit wallet when funded; otherwise keep message-limit enforcement.
  if (!isTrialSurface && walletBalance.remainingPence > 0) {
    return {
      allowed: true,
      messageCount: usage.messageCount,
      limit,
      planTier,
      walletMode: 'managed',
      wallet: walletGate,
    };
  }

  if (!isTrialSurface && walletBalance.exhausted && walletBalance.purchasedPence > 0) {
    if (walletGate.mode === 'byok') {
      return {
        allowed: true,
        messageCount: usage.messageCount,
        limit,
        planTier,
        walletMode: 'byok',
        wallet: walletGate,
      };
    }
  }

  if (limit !== Number.POSITIVE_INFINITY && usage.messageCount >= limit) {
    const prepaid = await getAivaPrepaidBalance(workspaceId);
    if (prepaid.remainingMessages > 0) {
      return {
        allowed: true,
        messageCount: usage.messageCount,
        limit,
        planTier,
        usePrepaid: true,
        walletMode: walletBalance.remainingPence > 0 ? 'managed' : undefined,
        wallet: walletGate,
      };
    }
    if (!usage.limitReachedAt) {
      await pool.query(
        `UPDATE aiva_usage SET limit_reached_at = NOW(), updated_at = NOW()
         WHERE workspace_id = $1 AND month = $2`,
        [workspaceId, usage.month],
      );
    }
    return {
      allowed: false,
      messageCount: usage.messageCount,
      limit,
      planTier,
      walletMode: 'denied',
      wallet: walletGate,
      actions: ['byok', 'topup', 'upgrade'],
      reason: 'monthly message limit reached',
    };
  }

  return {
    allowed: true,
    messageCount: usage.messageCount,
    limit,
    planTier,
    walletMode: walletBalance.remainingPence > 0 ? 'managed' : undefined,
    wallet: walletGate,
  };
}

/** Record one managed message; debit wallet and/or prepaid when applicable. */
export async function recordManagedMessage(
  workspaceId: string,
  opts?: {
    usePrepaid?: boolean;
    walletMode?: AivaWalletGateResult['mode'];
    model?: string;
    usage?: { inputTokens?: number; outputTokens?: number };
  },
): Promise<void> {
  await incrementMessageCount(workspaceId);
  if (opts?.walletMode === 'byok') {
    await recordAivaByokUsage({
      workspaceId,
      model: opts.model ?? 'unknown',
      usage: opts.usage,
    });
    return;
  }
  if (opts?.walletMode === 'managed') {
    await debitAivaWalletUsage({
      workspaceId,
      model: opts?.model ?? 'unknown',
      usage: opts?.usage,
      note: opts?.usePrepaid ? 'managed_message_prepaid_path' : 'managed_message',
    });
  }
  if (opts?.usePrepaid) {
    await debitAivaPrepaidMessage(workspaceId);
  }
}

export async function getUsageBar(workspaceId: string): Promise<{
  count: number;
  limit: number;
  resetsAt: string;
  planTier: string;
  walletRemainingPence: number;
  walletRemainingGbp: number;
  walletLowCredit: boolean;
  walletExhausted: boolean;
}> {
  const sub = await getSubscription(workspaceId);
  const planTier = sub?.planTier ?? 'trial';
  const limit = messageLimit(planTier);
  const usage = await getCurrentUsage(workspaceId);
  const wallet = await getAivaWalletBalance(workspaceId);
  const now = new Date();
  const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return {
    count: usage.messageCount,
    limit: limit === Number.POSITIVE_INFINITY ? 0 : limit,
    resetsAt,
    planTier,
    walletRemainingPence: wallet.remainingPence,
    walletRemainingGbp: wallet.remainingGbp,
    walletLowCredit: wallet.lowCredit,
    walletExhausted: wallet.exhausted,
  };
}

export async function maybeSendUsageAlerts(workspaceId: string): Promise<void> {
  const sub = await getSubscription(workspaceId);
  const planTier = sub?.planTier ?? 'trial';
  const limit = messageLimit(planTier);
  if (limit === Number.POSITIVE_INFINITY) return;

  const usage = await getCurrentUsage(workspaceId);
  const warningThreshold = Math.floor(limit * 0.8);
  const usagePercent = Math.min(100, Math.round((usage.messageCount / limit) * 100));
  const workerName = await firstWorkerName(workspaceId);

  if (usage.messageCount >= limit && !usage.limitReachedAt) {
    await pool.query(
      `UPDATE aiva_usage SET limit_reached_at = NOW(), updated_at = NOW()
       WHERE workspace_id = $1 AND month = $2`,
      [workspaceId, usage.month],
    );
    void sendUsageLimitReachedEmail({ workspaceId, workerName, messageLimit: limit }).catch((err) => {
      console.error('[usage] limit reached email failed:', err);
    });
    return;
  }

  if (usage.messageCount >= warningThreshold && !usage.warningSentAt) {
    await pool.query(
      `UPDATE aiva_usage SET warning_sent_at = NOW(), updated_at = NOW()
       WHERE workspace_id = $1 AND month = $2`,
      [workspaceId, usage.month],
    );
    void sendUsageWarningEmail({
      workspaceId,
      workerName,
      messageCount: usage.messageCount,
      messageLimit: limit,
      usagePercent,
    }).catch((err) => {
      console.error('[usage] warning email failed:', err);
    });
  }
}
