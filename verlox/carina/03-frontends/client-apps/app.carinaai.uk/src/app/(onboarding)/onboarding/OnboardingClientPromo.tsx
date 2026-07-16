'use client';

import type { ClientSignupPromo } from '@/lib/aiva-signup-promo';
import { OnboardingClientSimple } from './OnboardingClientSimple';

export function OnboardingClientPromo({ promo }: { promo: ClientSignupPromo }) {
  return (
    <div>
      <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-text-primary">
        Your referral includes a {promo.trialDays}-day trial with{' '}
        {promo.trialMessages.toLocaleString()} messages.
      </div>
      <OnboardingClientSimple />
    </div>
  );
}

export default OnboardingClientPromo;
