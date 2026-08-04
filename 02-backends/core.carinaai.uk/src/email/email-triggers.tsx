import React from 'react';
import { config } from '../config/index.js';
import { sendEmail } from './email-service.js';
import {
  aivaAppUrl,
  firstName,
  getWorkspaceContact,
  unsubscribeUrl as buildUnsubscribeUrl,
  upsertWorkspaceContact,
} from './workspace-contact.js';
import { AccountDeletedEmail, accountDeletedSubject } from './templates/account-deleted.js';
import { AivaCreatedEmail } from './templates/aiva-created.js';
import { buildAivaCreatedEmailData, aivaCreatedSubject } from './aiva-created-content.js';
import { CompleteWelcomeEmail } from './templates/complete-welcome.js';
import {
  buildCompleteWelcomeEmailData,
  completeWelcomeSubject,
  resolveAivaApkUrl,
} from './complete-welcome-content.js';
import { AutomationFailedEmail, automationFailedSubject } from './templates/automation-failed.js';
import { EscalationResolvedEmail, escalationResolvedSubject } from './templates/escalation-resolved.js';
import { GracePeriodWarningEmail, gracePeriodWarningSubject } from './templates/grace-period-warning.js';
import { PasswordResetEmail, passwordResetSubject } from './templates/password-reset.js';
import { PaymentFailedEmail, paymentFailedSubject } from './templates/payment-failed.js';
import { PaymentSuccessEmail, paymentSuccessSubject } from './templates/payment-success.js';
import { SubscriptionReactivatedEmail, subscriptionReactivatedSubject } from './templates/subscription-reactivated.js';
import { SubscriptionSuspendedEmail, subscriptionSuspendedSubject } from './templates/subscription-suspended.js';
import { TrialExpiredEmail, trialExpiredSubject } from './templates/trial-expired.js';
import { TrialExpiringEmail, trialExpiringSubject } from './templates/trial-expiring.js';
import { UsageLimitReachedEmail, usageLimitReachedSubject } from './templates/usage-limit-reached.js';
import { UsageWarningEmail, usageWarningSubject } from './templates/usage-warning.js';
import { WelcomeEmail, welcomeSubject } from './templates/welcome.js';
import {
  BusinessProvisionWelcomeEmail,
  businessProvisionWelcomeSubject,
} from './templates/business-provision-welcome.js';
import { normalizeAivaTier, type AivaPaidTier } from '../billing/aiva-tier.js';
import { getMarketplaceTemplate } from '../marketplace/template-registry.js';
import { getSubscriptionStatus } from '../workers/aiva-subscription-store.js';
import { getWorker, listWorkerChannels } from '../workers/worker-store.js';
import { pool } from '../memory/db.js';

async function contactForWorkspace(workspaceId: string): Promise<{
  email: string;
  name: string;
  unsubscribe?: string;
} | null> {
  const contact = await getWorkspaceContact(workspaceId);
  if (!contact) return null;
  return {
    email: contact.ownerEmail,
    name: contact.ownerName,
    unsubscribe: buildUnsubscribeUrl(contact.unsubscribeToken),
  };
}

export async function sendWelcomeEmail(input: {
  workspaceId: string;
  email: string;
  name?: string;
}): Promise<void> {
  await upsertWorkspaceContact(input.workspaceId, input.email, input.name ?? '');
  const contact = await contactForWorkspace(input.workspaceId);
  const fn = firstName(input.name ?? '', input.email);
  await sendEmail({
    to: input.email,
    subject: welcomeSubject(),
    template: (
      <WelcomeEmail
        firstName={fn}
        loginUrl={aivaAppUrl('/login')}
        apkUrl={resolveAivaApkUrl()}
        unsubscribeUrl={contact?.unsubscribe}
      />
    ),
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'welcome' }],
  });
}

export async function sendBusinessProvisionWelcomeEmail(input: {
  workspaceId: string;
  email: string;
  workspaceName: string;
  loginUrl: string;
  customDomainRow?: {
    cnameTarget: string;
    cfOwnershipVerificationName: string | null;
    cfOwnershipVerificationValue: string | null;
  } | null;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  const fn = firstName(input.workspaceName, input.email);
  await sendEmail({
    to: input.email,
    subject: businessProvisionWelcomeSubject(),
    template: (
      <BusinessProvisionWelcomeEmail
        firstName={fn}
        workspaceName={input.workspaceName}
        loginUrl={input.loginUrl}
        cnameTarget={input.customDomainRow?.cnameTarget ?? null}
        cfOwnershipVerificationName={input.customDomainRow?.cfOwnershipVerificationName ?? null}
        cfOwnershipVerificationValue={input.customDomainRow?.cfOwnershipVerificationValue ?? null}
        unsubscribeUrl={contact?.unsubscribe}
      />
    ),
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'business_provision' }],
  });
}

export async function sendAivaCreatedEmail(input: {
  workspaceId: string;
  workerName: string;
  role: string;
  workerId: string;
  hostedEmailAddress?: string | null;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;

  const data = await buildAivaCreatedEmailData({
    firstName: firstName(contact.name, contact.email),
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    workerName: input.workerName,
    role: input.role,
    hostedEmailAddress: input.hostedEmailAddress ?? null,
  });

  await sendEmail({
    to: contact.email,
    subject: aivaCreatedSubject(data.workerName),
    template: (
      <AivaCreatedEmail
        {...data}
        unsubscribeUrl={contact.unsubscribe}
      />
    ),
    workspaceId: input.workspaceId,
    transactional: true,
    tags: [{ name: 'category', value: 'aiva_created' }],
  });
}

export async function sendCompleteWelcomeEmail(input: {
  workspaceId: string;
  workerId: string;
  templateId?: string | null;
  channelId?: string | null;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;

  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker) return;

  const template = input.templateId && input.templateId !== 'custom'
    ? getMarketplaceTemplate(input.templateId)
    : null;
  const templateDomain = template?.domain ?? 'general_assistant';
  const workerRole = worker.roleDescription?.trim() || template?.description || 'AI employee';

  const subscription = await getSubscriptionStatus(input.workspaceId);
  const tier = normalizeAivaTier(String(subscription.planTier ?? 'trial'));
  const channels = await listWorkerChannels(worker.id);

  const data = buildCompleteWelcomeEmailData({
    firstName: firstName(contact.name, contact.email),
    workerName: worker.name,
    workerRole,
    templateDomain,
    tier: tier as AivaPaidTier,
    workerId: worker.id,
    connectedChannels: channels,
    selectedChannelId: input.channelId,
  });

  await sendEmail({
    to: contact.email,
    subject: completeWelcomeSubject(worker.name),
    template: (
      <CompleteWelcomeEmail
        {...data}
        unsubscribeUrl={contact.unsubscribe}
      />
    ),
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'onboarding_complete_welcome' }],
  });
}

export async function sendTrialExpiringEmail(input: {
  workspaceId: string;
  email: string;
  name: string;
  daysRemaining: number;
  workerName: string;
  trialEndsAt: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  await sendEmail({
    to: input.email,
    subject: trialExpiringSubject(input.daysRemaining),
    template: (
      <TrialExpiringEmail
        firstName={firstName(input.name, input.email)}
        daysRemaining={input.daysRemaining}
        workerName={input.workerName}
        upgradeUrl={aivaAppUrl('/billing/aiva')}
        trialEndsAt={input.trialEndsAt}
        unsubscribeUrl={contact?.unsubscribe}
      />
    ),
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'trial_expiring' }],
  });
}

export async function sendTrialExpiredEmail(input: {
  workspaceId: string;
  email: string;
  name: string;
  workerName: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  await sendEmail({
    to: input.email,
    subject: trialExpiredSubject(),
    template: (
      <TrialExpiredEmail
        firstName={firstName(input.name, input.email)}
        workerName={input.workerName}
        upgradeUrl={aivaAppUrl('/billing/aiva')}
        unsubscribeUrl={contact?.unsubscribe}
      />
    ),
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'trial_expired' }],
  });
}

export async function sendPaymentSuccessEmail(input: {
  workspaceId: string;
  planName: string;
  amount: string;
  nextBillingDate: string;
  invoiceUrl: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: paymentSuccessSubject(input.planName),
    template: (
      <PaymentSuccessEmail
        firstName={firstName(contact.name, contact.email)}
        planName={input.planName}
        amount={input.amount}
        nextBillingDate={input.nextBillingDate}
        invoiceUrl={input.invoiceUrl}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'payment_success' }],
  });
}

export async function sendPaymentFailedEmail(input: {
  workspaceId: string;
  amount: string;
  gracePeriodEndsAt: string;
  updateUrl: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: paymentFailedSubject(),
    template: (
      <PaymentFailedEmail
        firstName={firstName(contact.name, contact.email)}
        amount={input.amount}
        gracePeriodEndsAt={input.gracePeriodEndsAt}
        updateUrl={input.updateUrl}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'payment_failed' }],
  });
}

export async function sendGracePeriodWarningEmail(input: {
  workspaceId: string;
  workerName: string;
  gracePeriodEndsAt: string;
  updateUrl: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: gracePeriodWarningSubject(),
    template: (
      <GracePeriodWarningEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        gracePeriodEndsAt={input.gracePeriodEndsAt}
        updateUrl={input.updateUrl}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'grace_period_warning' }],
  });
}

export async function sendSubscriptionSuspendedEmail(input: {
  workspaceId: string;
  workerName: string;
  reactivateUrl: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: subscriptionSuspendedSubject(),
    template: (
      <SubscriptionSuspendedEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        reactivateUrl={input.reactivateUrl}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'subscription_suspended' }],
  });
}

export async function sendSubscriptionReactivatedEmail(input: {
  workspaceId: string;
  workerName: string;
  workerId?: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  const portal = input.workerId
    ? aivaAppUrl(`/aiva/${input.workerId}`)
    : aivaAppUrl('/aiva');
  await sendEmail({
    to: contact.email,
    subject: subscriptionReactivatedSubject(),
    template: (
      <SubscriptionReactivatedEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        portalUrl={portal}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'subscription_reactivated' }],
  });
}

export async function sendEscalationResolvedEmail(input: {
  workspaceId: string;
  workerName: string;
  workerId: string;
  escalationReason: string;
  resolutionNote: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: escalationResolvedSubject(),
    template: (
      <EscalationResolvedEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        escalationReason={input.escalationReason}
        resolutionNote={input.resolutionNote}
        portalUrl={aivaAppUrl(`/aiva/${input.workerId}/conversations`)}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'escalation_resolved' }],
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  await sendEmail({
    to: input.email,
    subject: passwordResetSubject(),
    template: (
      <PasswordResetEmail resetUrl={input.resetUrl} expiresInMinutes={input.expiresInMinutes} />
    ),
    transactional: true,
    tags: [{ name: 'category', value: 'password_reset' }],
  });
}

export async function sendAutomationFailedEmail(input: {
  workspaceId: string;
  workerName: string;
  workerId: string;
  automationName: string;
  scheduleLabel: string;
  errorMessage: string;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: automationFailedSubject(input.automationName),
    template: (
      <AutomationFailedEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        automationName={input.automationName}
        scheduleLabel={input.scheduleLabel}
        errorMessage={input.errorMessage}
        portalUrl={aivaAppUrl(`/aiva/${input.workerId}/automations`)}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'automation_failed' }],
  });
}

export async function sendUsageWarningEmail(input: {
  workspaceId: string;
  workerName: string;
  messageCount: number;
  messageLimit: number;
  usagePercent: number;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: usageWarningSubject(input.workerName),
    template: (
      <UsageWarningEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        messageCount={input.messageCount}
        messageLimit={input.messageLimit}
        usagePercent={input.usagePercent}
        billingUrl={aivaAppUrl('/billing/aiva')}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'usage_warning' }],
  });
}

export async function sendUsageLimitReachedEmail(input: {
  workspaceId: string;
  workerName: string;
  messageLimit: number;
}): Promise<void> {
  const contact = await contactForWorkspace(input.workspaceId);
  if (!contact) return;
  await sendEmail({
    to: contact.email,
    subject: usageLimitReachedSubject(input.workerName),
    template: (
      <UsageLimitReachedEmail
        firstName={firstName(contact.name, contact.email)}
        workerName={input.workerName}
        messageLimit={input.messageLimit}
        billingUrl={aivaAppUrl('/billing/aiva')}
      />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'usage_limit_reached' }],
  });
}

export async function sendAccountDeletedEmail(input: {
  workspaceId: string;
  email: string;
  name?: string;
}): Promise<void> {
  await sendEmail({
    to: input.email,
    subject: accountDeletedSubject(),
    template: (
      <AccountDeletedEmail firstName={firstName(input.name ?? '', input.email)} />
    ),
    transactional: true,
    workspaceId: input.workspaceId,
    tags: [{ name: 'category', value: 'account_deleted' }],
  });
}

export async function notifyCustomDomainVerified(input: {
  workspaceId: string;
  domain: string;
}): Promise<void> {
  const adminTo = config.notifications.brandingNotifyTo;
  if (!adminTo) {
    console.warn(
      '[email] Skipping custom-domain notify: set VERLOX_BRANDING_NOTIFY_EMAIL, SYSTEM_EMAIL_FROM, or EMAIL_FROM',
    );
    return;
  }
  await sendEmail({
    to: adminTo,
    subject: `Custom domain verified: ${input.domain}`,
    template: (
      <div>
        <p>Workspace {input.workspaceId} verified custom domain {input.domain}.</p>
      </div>
    ),
    transactional: true,
    tags: [{ name: 'category', value: 'branding_domain_verified' }],
  });
}

export async function firstWorkerName(workspaceId: string): Promise<string> {
  const result = await pool.query(
    `SELECT name FROM ai_workers
     WHERE workspace_id = $1 AND status != 'dismissed'
     ORDER BY created_at ASC LIMIT 1`,
    [workspaceId],
  );
  return String(result.rows[0]?.name ?? 'your Aiva');
}

export async function countWorkers(workspaceId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ai_workers
     WHERE workspace_id = $1 AND status != 'dismissed'`,
    [workspaceId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
