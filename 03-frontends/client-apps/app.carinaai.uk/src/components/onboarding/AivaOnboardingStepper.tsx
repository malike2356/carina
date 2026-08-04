'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['You', 'Hire', 'Go'] as const;

type AivaOnboardingStepperProps = {
  step: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
};

export function AivaOnboardingStepper({ step, onStepClick }: AivaOnboardingStepperProps) {
  return (
    <nav aria-label="Onboarding progress" className="flex items-center justify-center">
      {STEP_LABELS.map((label, index) => {
        const stepNum = (index + 1) as 1 | 2 | 3;
        const state = stepNum < step ? 'completed' : stepNum === step ? 'current' : 'future';

        return (
          <div key={label} className="flex items-center">
            {index > 0 ? (
              <div
                className={cn(
                  'h-px w-8 transition-colors duration-300 sm:w-12',
                  stepNum <= step ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (state === 'completed' && onStepClick) onStepClick(stepNum);
              }}
              disabled={state !== 'completed' || !onStepClick}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex flex-col items-center gap-1.5 focus:outline-none disabled:cursor-default"
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200',
                  state === 'completed' &&
                    'cursor-pointer bg-primary text-primary-foreground hover:brightness-110',
                  state === 'current' &&
                    'bg-primary text-primary-foreground ring-2 ring-primary/25 ring-offset-2 ring-offset-background',
                  state === 'future' && 'border border-border bg-muted text-text-muted',
                )}
              >
                {state === 'completed' ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] font-medium sm:block',
                  state === 'current' && 'text-text-primary',
                  state === 'completed' && 'text-primary',
                  state === 'future' && 'text-text-muted',
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
