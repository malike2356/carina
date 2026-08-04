'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/shell/BrandMark';
import { OnboardingProvider, useOnboardingStep } from '@/lib/onboarding-context';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['Business', 'Role', 'Name', 'Channels', 'Setting up', 'Done'] as const;

function OnboardingStepIndicator() {
  const { step, setStep } = useOnboardingStep();

  return (
    <nav aria-label="Onboarding progress" className="flex items-center">
      {STEP_LABELS.map((label, index) => {
        const stepNum = index + 1;
        const state =
          stepNum < step ? 'completed' : stepNum === step ? 'current' : 'future';

        return (
          <div key={label} className="flex items-center">
            {index > 0 ? (
              <div
                className={cn(
                  'h-px w-6 transition-colors duration-300 sm:w-8',
                  stepNum <= step ? 'bg-accent' : 'bg-border',
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => state === 'completed' && setStep(stepNum)}
              disabled={state !== 'completed'}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex flex-col items-center gap-1 focus:outline-none"
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200',
                  state === 'completed' && 'cursor-pointer bg-accent text-primary-foreground hover:brightness-110',
                  state === 'current' &&
                    'bg-accent text-primary-foreground ring-2 ring-accent/30 ring-offset-2 ring-offset-base',
                  state === 'future' && 'border border-border bg-overlay text-text-muted',
                )}
              >
                {state === 'completed' ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  'hidden text-[9px] font-medium transition-colors sm:block',
                  state === 'current' && 'text-accent',
                  state === 'completed' && 'text-text-muted',
                  state === 'future' && 'text-text-muted opacity-50',
                )}
              >
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

function OnboardingShellInner({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-base text-text-primary">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <div className="w-[72px] shrink-0">
          <BrandMark nameClassName="text-sm font-semibold text-text-primary" size={28} />
        </div>
        <div className="flex flex-1 justify-center">
          <OnboardingStepIndicator />
        </div>
        <div className="w-[72px]" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <OnboardingProvider>
      <OnboardingShellInner>{children}</OnboardingShellInner>
    </OnboardingProvider>
  );
}
