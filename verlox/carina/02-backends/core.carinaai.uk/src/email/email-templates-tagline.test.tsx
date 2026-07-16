import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { EMAIL_TAGLINE } from './email-styles.js';
import { AivaCreatedEmail } from './templates/aiva-created.js';
import { AutomationFailedEmail } from './templates/automation-failed.js';
import { EscalationResolvedEmail } from './templates/escalation-resolved.js';
import { GracePeriodWarningEmail } from './templates/grace-period-warning.js';
import { PasswordResetEmail } from './templates/password-reset.js';
import { PaymentFailedEmail } from './templates/payment-failed.js';
import { PaymentSuccessEmail } from './templates/payment-success.js';
import { PlainEmailTemplate } from './templates/plain-email.js';
import { SubscriptionReactivatedEmail } from './templates/subscription-reactivated.js';
import { SubscriptionSuspendedEmail } from './templates/subscription-suspended.js';
import { TrialExpiredEmail } from './templates/trial-expired.js';
import { TrialExpiringEmail } from './templates/trial-expiring.js';
import { WelcomeEmail } from './templates/welcome.js';

const unsubscribe = 'https://app.carinaai.uk/unsubscribe?token=test';

async function expectTaglineInTemplate(name: string, element: React.ReactElement): Promise<void> {
  const html = await render(element);
  expect(html, `${name} missing canonical tagline`).toContain(EMAIL_TAGLINE);
}

describe('lifecycle email taglines', () => {
  it('includes canonical GTM tagline in all 12 lifecycle templates', async () => {
    await expectTaglineInTemplate('welcome', (
      <WelcomeEmail firstName="Alex" loginUrl="https://app.carinaai.uk/login" unsubscribeUrl={unsubscribe} />
    ));
    await expectTaglineInTemplate('aiva-created', (
      <AivaCreatedEmail
        firstName="Alex"
        workerName="Aria"
        role="Customer support"
        portalUrl="https://app.carinaai.uk/aiva/w1"
        unsubscribeUrl={unsubscribe}
      />
    ));
    await expectTaglineInTemplate('trial-expiring', (
      <TrialExpiringEmail
        firstName="Alex"
        daysRemaining={2}
        workerName="Aria"
        upgradeUrl="https://app.carinaai.uk/billing/aiva"
        trialEndsAt="2026-07-01T00:00:00.000Z"
        unsubscribeUrl={unsubscribe}
      />
    ));
    await expectTaglineInTemplate('trial-expired', (
      <TrialExpiredEmail
        firstName="Alex"
        workerName="Aria"
        upgradeUrl="https://app.carinaai.uk/billing/aiva"
        unsubscribeUrl={unsubscribe}
      />
    ));
    await expectTaglineInTemplate('payment-success', (
      <PaymentSuccessEmail
        firstName="Alex"
        planName="Growth"
        amount="GBP 49.00"
        nextBillingDate="1 Aug 2026"
        invoiceUrl="https://billing.stripe.com/invoice"
      />
    ));
    await expectTaglineInTemplate('payment-failed', (
      <PaymentFailedEmail
        firstName="Alex"
        amount="GBP 49.00"
        gracePeriodEndsAt="2026-07-08T00:00:00.000Z"
        updateUrl="https://app.carinaai.uk/billing/aiva"
      />
    ));
    await expectTaglineInTemplate('grace-period-warning', (
      <GracePeriodWarningEmail
        firstName="Alex"
        workerName="Aria"
        gracePeriodEndsAt="2026-07-08T00:00:00.000Z"
        updateUrl="https://app.carinaai.uk/billing/aiva"
      />
    ));
    await expectTaglineInTemplate('subscription-suspended', (
      <SubscriptionSuspendedEmail
        firstName="Alex"
        workerName="Aria"
        reactivateUrl="https://app.carinaai.uk/billing/aiva"
      />
    ));
    await expectTaglineInTemplate('subscription-reactivated', (
      <SubscriptionReactivatedEmail
        firstName="Alex"
        workerName="Aria"
        portalUrl="https://app.carinaai.uk/aiva/w1"
      />
    ));
    await expectTaglineInTemplate('escalation-resolved', (
      <EscalationResolvedEmail
        firstName="Alex"
        workerName="Aria"
        escalationReason="Refund request"
        resolutionNote="Issued credit per policy"
        portalUrl="https://app.carinaai.uk/aiva/w1/conversations"
      />
    ));
    await expectTaglineInTemplate('password-reset', (
      <PasswordResetEmail resetUrl="https://app.carinaai.uk/reset?token=abc" expiresInMinutes={15} />
    ));
    await expectTaglineInTemplate('automation-failed', (
      <AutomationFailedEmail
        firstName="Alex"
        workerName="Aria"
        automationName="Daily digest"
        scheduleLabel="Every day at 8 am"
        errorMessage="LLM timeout"
        portalUrl="https://app.carinaai.uk/aiva/w1/automations"
      />
    ));
  });

  it('includes tagline in channel plain-email wrapper', async () => {
    const html = await render(<PlainEmailTemplate content="Hello" workerName="Aria" />);
    expect(html).toContain(EMAIL_TAGLINE);
  });
});
