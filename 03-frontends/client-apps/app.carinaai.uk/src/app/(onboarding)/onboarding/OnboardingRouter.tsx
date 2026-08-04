'use client';

import { useEffect, useState } from 'react';
import {
  getSignupPromo,
  readClientSignupPromo,
  type ClientSignupPromo,
} from '@/lib/aiva-signup-promo';
import { OnboardingClientSimple } from './OnboardingClientSimple';
import { OnboardingClientPromo } from './OnboardingClientPromo';

export function OnboardingRouter({ refFromUrl }: { refFromUrl: string | null }) {
  const [promo, setPromo] = useState<ClientSignupPromo | null>(() => getSignupPromo(refFromUrl));

  useEffect(() => {
    setPromo(getSignupPromo(refFromUrl) ?? readClientSignupPromo());
  }, [refFromUrl]);

  if (promo) {
    return <OnboardingClientPromo promo={promo} />;
  }

  return <OnboardingClientSimple />;
}
