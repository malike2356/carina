'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type OnboardingContextValue = {
  step: number;
  setStep: (step: number) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1);
  const value = useMemo(() => ({ step, setStep }), [step]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingStep(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingStep must be used within OnboardingProvider');
  }
  return ctx;
}
