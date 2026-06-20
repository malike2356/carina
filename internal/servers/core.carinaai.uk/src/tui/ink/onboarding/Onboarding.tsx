import React, { useState } from 'react';
import { WelcomeStep } from './steps/WelcomeStep.js';
import { WorkspaceStep } from './steps/WorkspaceStep.js';
import { ProviderStep } from './steps/ProviderStep.js';
import { ApiKeyStep } from './steps/ApiKeyStep.js';
import { HomeStep } from './steps/HomeStep.js';
import { PersonalityStep } from './steps/PersonalityStep.js';
import { TourStep } from './steps/TourStep.js';
import { QuickstartTourStep } from './steps/QuickstartTourStep.js';
import { DoneStep } from './steps/DoneStep.js';
import type { OnboardingState, OnboardingStep, TourChoice } from './types.js';

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'workspace',
  'provider',
  'api-key',
  'home',
  'personality',
  'tour',
  'quickstart',
  'done',
];

interface OnboardingProps {
  onComplete: (state: OnboardingState) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [state, setState] = useState<OnboardingState>({
    step: 'welcome',
    workspaceName: null,
    provider: null,
    model: null,
    apiKey: null,
    homeDir: null,
    personality: null,
    tourChoice: null,
  });

  function advance(partial: Partial<OnboardingState>) {
    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.step);
      const nextStep = STEP_ORDER[currentIndex + 1] ?? 'done';
      return { ...prev, ...partial, step: nextStep };
    });
  }

  function finishTour(choice: TourChoice) {
    setState((prev) => {
      const next: OnboardingState = { ...prev, tourChoice: choice };
      if (choice === 'yes') {
        return { ...next, step: 'quickstart' };
      }
      return { ...next, step: 'done' };
    });
  }

  switch (state.step) {
    case 'welcome':
      return <WelcomeStep onNext={() => advance({})} />;
    case 'workspace':
      return <WorkspaceStep onNext={(workspaceName) => advance({ workspaceName })} />;
    case 'provider':
      return (
        <ProviderStep
          onNext={(provider, model) => advance({ provider, model })}
        />
      );
    case 'api-key':
      return (
        <ApiKeyStep
          provider={state.provider!}
          model={state.model!}
          onNext={(apiKey) => advance({ apiKey })}
        />
      );
    case 'home':
      return <HomeStep onNext={(homeDir) => advance({ homeDir })} />;
    case 'personality':
      return (
        <PersonalityStep
          onNext={(personality) => advance({ personality })}
        />
      );
    case 'tour':
      return <TourStep onNext={finishTour} />;
    case 'quickstart':
      return <QuickstartTourStep onNext={() => setState((prev) => ({ ...prev, step: 'done' }))} />;
    case 'done':
      return (
        <DoneStep
          state={state}
          onFinish={() => onComplete({ ...state, step: 'done' })}
        />
      );
    default:
      return null;
  }
}
